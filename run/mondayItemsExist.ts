import GitRest from "../src/utils/git-rest";
import { type ActionResponse } from "../src/types";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });
const MONDAY_KEY = process.env.MONDAY_KEY;
const MONDAY_BOARD = process.env.MONDAY_BOARD;
const MONDAY_ISSUE_NUMBER_COLUMN_ID = process.env.MONDAY_ISSUE_NUMBER_COLUMN_ID;

interface QueryVariables {
  [key: string]: string | string[];
}

await gitRest.iterateAllIssues({
  action: (issue) => queryForId(String(issue.number)),
  state: "open",
  per_page: 100,
  sleepMs: 3000,
});

/**
 * Query Monday.com for an item matching the issue number
 */
async function queryForId(issueNumber: string): Promise<ActionResponse> {
  if (!MONDAY_KEY || !MONDAY_BOARD || !MONDAY_ISSUE_NUMBER_COLUMN_ID) {
    console.error(
      "Missing required environment variables. Please ensure MONDAY_KEY, MONDAY_BOARD, and MONDAY_ISSUE_NUMBER_COLUMN_ID are set.",
    );
    process.exit(1);
  }  
  
  const query = `query QueryForId($board_id: ID!, $column_id: String!, $column_values: [String!]!) {
      items_page_by_column_values(
        board_id: $board_id,
        columns: {
          column_id: $column_id,
          column_values: $column_values
        },
      ) {
        items {
          id
        }
      }
    }`;

  const queryVariables: QueryVariables = {
    board_id: MONDAY_BOARD,
    column_id: MONDAY_ISSUE_NUMBER_COLUMN_ID,
    column_values: [issueNumber],
  };

  const { response, error } = await runQuery(query, queryVariables);
  if (error) {
    console.error(error);
    return "failed";
  }

  const items = response?.data?.items_page_by_column_values?.items ?? [];
  if (items.length === 0) {
    console.warn(`No Monday task found for Github Issue #${issueNumber}.`);
    return "skipped";
  }

  if (items.length > 1) {
    console.error(
      `Multiple Monday items found for Issue #${issueNumber}. Requires manual review.`,
    );
    return "failed";
  }

  const [{ id }] = items;
  console.log(`Found existing Monday task for Issue #${issueNumber}: ${id}.`);
  return "triggered";
}

/**
 * Calls the Monday.com API with a provided query.
 * Does not handle API errors. The caller should handle errors and look for required shape of response.
 */
async function runQuery(
  query: string,
  variables: QueryVariables = {},
): Promise<{ response: any; error: string | null }> {
  try {
    const response = await fetch("https://api.monday.com/v2", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: MONDAY_KEY,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      return {
        response: null,
        error: `${response.status} (${response.statusText}) from API: ${JSON.stringify(errorBody)}`,
      };
    }
    return { response: await response.json(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { response: null, error: message };
  }
}
