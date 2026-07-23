// Netlify Function: fetches "Email Marketing Planner" board items directly
// from Monday.com's API, so the dashboard can stay live once it's outside Cowork.
//
// Requires an env var set in Netlify (Site settings -> Environment variables):
//   MONDAY_API_TOKEN = <your personal Monday.com API token>

const BOARD_ID = 7035266275;
const COLUMN_IDS = [
  'person',
  'status__1',
  'date_mks7mh1r',
  'status_12',
  'date',
  'status8',
  'dropdown_mm1cac03'
];

exports.handler = async function () {
  const token = process.env.MONDAY_API_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'MONDAY_API_TOKEN is not set in Netlify environment variables.' })
    };
  }

  const query = `
    query ($boardId: [ID!], $columnIds: [String!]) {
      boards(ids: $boardId) {
        items_page(limit: 100) {
          items {
            id
            name
            group { id title }
            column_values(ids: $columnIds) {
              id
              text
            }
          }
        }
      }
    }
  `;

  try {
    const resp = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-10'
      },
      body: JSON.stringify({
        query,
        variables: { boardId: [BOARD_ID], columnIds: COLUMN_IDS }
      })
    });

    const json = await resp.json();

    if (json.errors) {
      return { statusCode: 502, body: JSON.stringify({ error: json.errors }) };
    }

    const rawItems = (json.data && json.data.boards[0] && json.data.boards[0].items_page.items) || [];

    // Flatten monday's column_values array into the { columnId: text } shape
    // the dashboard's existing render logic already expects.
    const items = rawItems.map(function (it) {
      const cv = {};
      (it.column_values || []).forEach(function (c) {
        cv[c.id] = c.text;
      });
      return { id: it.id, name: it.name, group: { id: it.group.id }, column_values: cv };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ items: items })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    };
  }
};
