# Skylark BI Agent — Monday.com Business Intelligence

An AI-powered business intelligence agent that connects to Monday.com boards (Work Orders & Deals) and answers founder-level business questions through a conversational interface.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black) ![AI](https://img.shields.io/badge/Gemini-2.0_Flash-blue) ![Platform](https://img.shields.io/badge/Monday.com-API_v2-ff6d00)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Chat Interface (React, Glassmorphism UI)       │    │
│  │  • Markdown rendering  • Suggested queries      │    │
│  │  • Typing indicators   • Leadership mode        │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │ POST /api/chat                    │
│  ┌───────────────────▼─────────────────────────────┐    │
│  │  API Layer (Next.js API Routes)                  │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │    │
│  │  │ Monday   │  │   Data    │  │   Gemini     │ │    │
│  │  │ Client   │→ │ Processor │→ │  AI Engine   │ │    │
│  │  │ (GraphQL)│  │ (Cleaner) │  │ (Interpreter)│ │    │
│  │  └──────────┘  └───────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  ┌──────────────┐                   ┌──────────────┐
  │  Monday.com  │                   │  Google AI   │
  │  GraphQL API │                   │  Gemini API  │
  │  (Read Only) │                   │              │
  └──────────────┘                   └──────────────┘
```

## Key Components

| File | Purpose |
|------|---------|
| `lib/monday.js` | Monday.com GraphQL client with pagination and error handling |
| `lib/data-processor.js` | Data cleaning: date normalization, number parsing, sector standardization, duplicate header removal |
| `lib/ai-engine.js` | Gemini AI integration with domain-aware system prompts and leadership report generation |
| `lib/cache.js` | In-memory TTL cache (5 min) to reduce API calls |
| `app/api/chat/route.js` | Main chat endpoint: fetches data → cleans → queries AI → responds |
| `app/api/health/route.js` | Health check: verifies Monday.com + Gemini connections |
| `app/page.js` | React chat interface with glassmorphism design |

## Setup Instructions

### Prerequisites
- Node.js 18+
- Monday.com account with API token
- Google AI Studio (Gemini) API key

### 1. Monday.com Board Setup

1. **Create a Monday.com account** at [monday.com](https://monday.com)
2. **Import the CSV files** as two separate boards:
   - Board 1: **"Deal Funnel"** — Import `Deal funnel Data.xlsx`
   - Board 2: **"Work Order Tracker"** — Import `Work_Order_Tracker Data.xlsx`
3. **Get your API token**:
   - Go to your avatar → Administration → Connections → API
   - Generate a personal API token
4. **Get board IDs**:
   - Open each board in Monday.com
   - The board ID is in the URL: `monday.com/boards/BOARD_ID`
   - Or use the `/api/health` endpoint after configuring the API token

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Copy the key

### 3. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# Monday.com
MONDAY_API_TOKEN=your_monday_api_token_here
MONDAY_DEALS_BOARD_ID=your_deals_board_id
MONDAY_WORKORDERS_BOARD_ID=your_work_orders_board_id

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add MONDAY_API_TOKEN
vercel env add MONDAY_DEALS_BOARD_ID
vercel env add MONDAY_WORKORDERS_BOARD_ID
vercel env add GEMINI_API_KEY

# Redeploy with env vars
vercel --prod
```

Or deploy via the [Vercel Dashboard](https://vercel.com/new):
1. Import the GitHub repository
2. Add environment variables in Settings → Environment Variables
3. Deploy

## Data Handling

The agent handles these data quality issues automatically:
- **Duplicate header rows** — Detected and filtered
- **Missing values** — Tracked and reported to the AI for context
- **`#VALUE!` errors** — Parsed as null
- **Inconsistent sectors** — Normalized (e.g., "mining" → "Mining")
- **Mixed date formats** — Parsed to ISO format
- **Quantities with units** — "500 HA", "350 KM" → extracted numeric values

## Sample Queries

- "How's our pipeline looking for energy sector this quarter?"
- "What's the total deal value for won deals by sector?"
- "Show me the top 10 highest value open deals"
- "Which sales owners have the best win rates?"
- "Outstanding receivables by priority accounts"
- "Compare work order completion rates across sectors"
- "Generate a leadership update for this quarter"
- "What's our collection rate vs billed amount?"

## Tech Stack Decisions

See [DECISION_LOG.md](./DECISION_LOG.md) for detailed rationale on:
- Why API over MCP
- Why Gemini over other AI models
- Full data context vs structured querying
- Deployment and caching strategies
