import { NextResponse } from 'next/server';
import { getBoardData, checkConnection } from '@/lib/monday';
import { processDealsData, processWorkOrdersData, generateQualitySummary } from '@/lib/data-processor';
import { processQuery } from '@/lib/ai-engine';
import cache from '@/lib/cache';

/**
 * Fetch and process data from both Monday.com boards
 * Uses caching to avoid excessive API calls
 */
async function getProcessedData() {
  // Check cache first
  const cached = cache.get('processedData');
  if (cached) {
    return cached;
  }

  const dealsBoardId = process.env.MONDAY_DEALS_BOARD_ID;
  const workOrdersBoardId = process.env.MONDAY_WORKORDERS_BOARD_ID;

  if (!dealsBoardId || !workOrdersBoardId) {
    throw new Error('Board IDs not configured. Set MONDAY_DEALS_BOARD_ID and MONDAY_WORKORDERS_BOARD_ID environment variables.');
  }

  // Fetch both boards in parallel
  const [dealsRaw, workOrdersRaw] = await Promise.all([
    getBoardData(dealsBoardId),
    getBoardData(workOrdersBoardId),
  ]);

  // Process and clean data
  const dealsResult = processDealsData(dealsRaw.rows);
  const workOrdersResult = processWorkOrdersData(workOrdersRaw.rows);

  const qualitySummary = generateQualitySummary(dealsResult.quality, workOrdersResult.quality);

  const result = {
    deals: dealsResult.data,
    workOrders: workOrdersResult.data,
    dealsQuality: dealsResult.quality,
    workOrdersQuality: workOrdersResult.quality,
    qualitySummary,
    metadata: {
      dealsBoardName: dealsRaw.boardName,
      workOrdersBoardName: workOrdersRaw.boardName,
      fetchedAt: new Date().toISOString(),
    },
  };

  // Cache for 5 minutes
  cache.set('processedData', result);

  return result;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check required env vars
    if (!process.env.MONDAY_API_TOKEN) {
      return NextResponse.json(
        { error: 'Monday.com API token is not configured. Set MONDAY_API_TOKEN environment variable.' },
        { status: 500 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured. Set GEMINI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Fetch and process data
    const data = await getProcessedData();

    // Process query with AI
    const result = await processQuery(
      message.trim(),
      data.deals,
      data.workOrders,
      data.dealsQuality,
      data.workOrdersQuality,
      conversationHistory
    );

    return NextResponse.json({
      response: result.response,
      isLeadershipUpdate: result.isLeadershipUpdate,
      metadata: {
        dealsCount: data.deals.length,
        workOrdersCount: data.workOrders.length,
        dataFreshnessAt: data.metadata.fetchedAt,
        qualitySummary: data.qualitySummary,
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Provide user-friendly error messages
    let errorMessage = 'An unexpected error occurred. Please try again.';
    let statusCode = 500;

    if (error.message.includes('MONDAY_API_TOKEN')) {
      errorMessage = 'Monday.com API connection is not configured. Please check the API token.';
    } else if (error.message.includes('GEMINI_API_KEY')) {
      errorMessage = 'AI service is not configured. Please check the Gemini API key.';
    } else if (error.message.includes('Board') && error.message.includes('not found')) {
      errorMessage = 'Monday.com boards not found. Please verify the board IDs in the configuration.';
    } else if (error.message.includes('Board IDs not configured')) {
      errorMessage = error.message;
    } else if (error.message.includes('API error')) {
      errorMessage = 'Failed to connect to Monday.com. Please verify your API token and try again.';
    } else if (error.message.includes('Failed to process query')) {
      errorMessage = 'The AI service encountered an error. Please try rephrasing your question.';
    }

    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: statusCode }
    );
  }
}
