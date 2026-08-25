import { NextResponse } from 'next/server';
import { checkConnection, listBoards } from '@/lib/monday';
import cache from '@/lib/cache';

export async function GET() {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mondayApi: { status: 'unknown' },
      geminiApi: { status: process.env.GEMINI_API_KEY ? 'configured' : 'not configured' },
    },
    config: {
      dealsBoardId: process.env.MONDAY_DEALS_BOARD_ID ? 'configured' : 'not set',
      workOrdersBoardId: process.env.MONDAY_WORKORDERS_BOARD_ID ? 'configured' : 'not set',
    },
    cache: cache.stats(),
  };

  try {
    if (process.env.MONDAY_API_TOKEN) {
      const connection = await checkConnection();
      status.services.mondayApi = {
        status: connection.connected ? 'connected' : 'error',
        user: connection.connected ? connection.user : undefined,
        error: connection.error || undefined,
      };

      // List available boards for setup help
      if (connection.connected) {
        try {
          const boards = await listBoards();
          status.availableBoards = boards.map(b => ({
            id: b.id,
            name: b.name,
            itemCount: b.items_count,
          }));
        } catch (e) {
          status.availableBoards = [];
        }
      }
    } else {
      status.services.mondayApi = { status: 'not configured' };
    }
  } catch (error) {
    status.services.mondayApi = { status: 'error', error: error.message };
  }

  const allOk = status.services.mondayApi.status === 'connected' &&
    status.services.geminiApi.status === 'configured' &&
    status.config.dealsBoardId === 'configured' &&
    status.config.workOrdersBoardId === 'configured';

  status.status = allOk ? 'ok' : 'needs_setup';

  return NextResponse.json(status);
}
