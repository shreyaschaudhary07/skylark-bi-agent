# Decision Log — Skylark Drones BI Agent

## Key Assumptions

1. **Data is masked but proportional**: Deal values and amounts are masked but maintain relative proportions, making comparative analysis (sector breakdowns, pipeline health, top deals) valid even if absolute numbers are anonymized.

2. **Deal Name is the cross-board key**: The "Deal name masked" field in Work Orders maps to "Deal Name" in Deals. While customer codes differ between boards (COMPANY_xxx vs WOCOMPANY_xxx), the deal name provides the primary join key.

3. **"Energy sector" = Renewables**: When founders ask about "energy sector", this maps to the "Renewables" sector label in the data. The data uses "Renewables" rather than "Energy" as the sector name.

4. **"This quarter" is dynamic**: Quarter boundaries are computed relative to the current date, so the agent always answers with the most relevant time window.

5. **Deal Stage progression is sequential A→K, with L/M/N/O as terminal/parked states**: Stages A through K represent active progression. L (Project Lost), M (On Hold), N/O (Not Relevant) are terminal states.

6. **Duplicate header rows in CSV are data artifacts**: Rows 60 and 189 in the Deals data contain header text as values (e.g., "Deal Status" in the Deal Status column). These are filtered during processing.

## Trade-offs Chosen

| Trade-off | Choice | Why |
|-----------|--------|-----|
| **MCP vs API** | Monday.com GraphQL API | MCP requires a running sidecar server, which complicates hosted deployment. The API makes the app fully self-contained on Vercel with zero infrastructure overhead. For a prototype meant to be "testable without local setup," API is the pragmatic choice. |
| **AI Model** | Google Gemini 2.0 Flash | Generous free tier (good for a demo/prototype), fast response times, strong at structured data reasoning. Trade-off: slightly less nuanced than GPT-4 for complex business reasoning, but sufficient for this use case. |
| **Full data in prompt vs. structured querying** | Full data in prompt context | Sending all ~500 records in the AI context window ensures the AI can answer any question without needing a complex query-building layer. Trade-off: higher token usage per query, but Gemini Flash handles this well with its 1M token context window. With more time, I'd build a structured query layer for efficiency. |
| **Server-side caching** | 5-minute in-memory TTL cache | Prevents hammering the Monday.com API on every chat message while keeping data reasonably fresh. Trade-off: stale data for up to 5 minutes, but acceptable for BI queries. |
| **Markdown rendering** | Custom lightweight renderer | Avoids adding a heavy library (react-markdown + dependencies). Trade-off: doesn't handle every edge case, but covers tables, headers, bold, lists, code blocks — the formats the AI actually uses. |
| **Deployment platform** | Vercel | Zero-config deployment with Next.js, free tier, environment variable management, global CDN. Trade-off: cold starts on serverless functions, but acceptable for a prototype. |

## What I'd Do Differently With More Time

1. **Structured query layer**: Instead of sending all data to the AI every time, build an intermediate layer that interprets the user's intent, constructs targeted data queries, and only sends relevant subsets to the AI. This would reduce token usage by 80%+ and speed up responses.

2. **Streaming responses**: Use Gemini's streaming API to show responses token-by-token instead of waiting for the full response. This significantly improves perceived performance.

3. **Persistent conversation memory**: Store conversation history in a database to enable multi-session context. Currently, context is lost on page refresh.

4. **Data visualization**: Add Chart.js or D3 charts embedded in responses — pipeline funnels, sector pie charts, revenue trend lines. Visual data is far more impactful for leadership.

5. **Scheduled reports**: Implement automated weekly/monthly leadership reports that are generated and emailed without manual prompting.

6. **Board write-back**: Allow the agent to update Monday.com boards (e.g., flag deals needing attention, add notes) — currently read-only as specified.

7. **Multi-user auth**: Add user authentication so different stakeholders see role-appropriate data and the system tracks who asked what.

8. **Semantic caching**: Cache AI responses for semantically similar questions to reduce API calls and improve response times.

## Interpretation of "Leadership Updates"

**My interpretation**: The agent should generate structured executive summaries on demand that are ready to be copy-pasted into board presentations, emails to investors, or team standups.

**Implementation**: When the user asks for a "leadership update," "board report," "quarterly review," or similar, the system:

1. **Activates a specialized prompt** that instructs the AI to produce a comprehensive, structured executive brief
2. **Covers all key areas**: Pipeline overview, revenue & collections, sector performance, key deals, operational metrics, data quality caveats, and recommended actions
3. **Formats for copy-paste**: Uses clear markdown sections, bullet points, and bold metrics that transfer cleanly to slides or emails
4. **Tags the response** with a visual "📊 Leadership Update" badge in the UI so users can quickly distinguish it from regular Q&A

**Why this interpretation**: Founders preparing for board meetings or investor updates need a comprehensive snapshot, not just answers to individual questions. The structured format saves them the cognitive work of synthesizing multiple queries into a coherent narrative. The copy-paste readiness respects the time constraint — a founder should be able to ask once and get a presentation-ready summary.
