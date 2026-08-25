/**
 * Monday.com GraphQL API Client
 * Handles authentication, pagination, and data extraction from Monday.com boards
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Execute a GraphQL query against Monday.com API
 */
async function mondayQuery(query, variables = {}) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new Error('MONDAY_API_TOKEN environment variable is not set');
  }

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Monday.com API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.errors && data.errors.length > 0) {
    throw new Error(`Monday.com GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
  }

  return data.data;
}

/**
 * Fetch all items from a board with pagination
 * Monday.com API v2 limits items per page
 */
async function fetchBoardItems(boardId) {
  const allItems = [];
  let cursor = null;
  let hasMore = true;
  let columnDefs = null;

  // First query to get board info and first page
  const firstQuery = `
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            column_values {
              id
              column {
                title
              }
              text
              value
            }
          }
        }
      }
    }
  `;

  const firstResult = await mondayQuery(firstQuery, { boardId: [boardId] });

  if (!firstResult.boards || firstResult.boards.length === 0) {
    throw new Error(`Board ${boardId} not found`);
  }

  const board = firstResult.boards[0];
  columnDefs = board.columns;
  const firstPage = board.items_page;

  allItems.push(...firstPage.items);
  cursor = firstPage.cursor;

  // Paginate through remaining items
  while (cursor) {
    const nextQuery = `
      query ($boardId: [ID!]!, $cursor: String!) {
        boards(ids: $boardId) {
          items_page(limit: 500, cursor: $cursor) {
            cursor
            items {
              id
              name
              column_values {
                id
                column {
                  title
                }
                text
                value
              }
            }
          }
        }
      }
    `;

    const nextResult = await mondayQuery(nextQuery, { boardId: [boardId], cursor });
    const nextPage = nextResult.boards[0].items_page;
    allItems.push(...nextPage.items);
    cursor = nextPage.cursor;
  }

  return {
    boardName: board.name,
    columns: columnDefs,
    items: allItems,
  };
}

/**
 * Convert Monday.com item format to flat row objects
 */
function flattenItems(items) {
  return items.map(item => {
    const row = { _id: item.id, _name: item.name };

    for (const cv of item.column_values) {
      const colTitle = cv.column?.title || cv.id;
      // Use the text representation (human-readable)
      row[colTitle] = cv.text || '';
    }

    return row;
  });
}

/**
 * List all boards accessible to the API token
 */
async function listBoards() {
  const query = `
    query {
      boards(limit: 50) {
        id
        name
        items_count
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const result = await mondayQuery(query);
  return result.boards || [];
}

/**
 * Check API connectivity
 */
async function checkConnection() {
  try {
    const query = `query { me { name email } }`;
    const result = await mondayQuery(query);
    return { connected: true, user: result.me };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Fetch and flatten all data from a board
 */
async function getBoardData(boardId) {
  const raw = await fetchBoardItems(boardId);
  const rows = flattenItems(raw.items);

  return {
    boardName: raw.boardName,
    columns: raw.columns.map(c => ({ id: c.id, title: c.title, type: c.type })),
    rows,
    totalItems: rows.length,
  };
}

module.exports = {
  mondayQuery,
  fetchBoardItems,
  flattenItems,
  listBoards,
  checkConnection,
  getBoardData,
};
