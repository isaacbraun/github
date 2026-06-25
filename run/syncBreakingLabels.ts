import GitRest from "../src/utils/git-rest";
import type { ActionResponse, Issue } from "../src/types";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

async function findAndSyncLabel(label: string): Promise<void> {
  console.log(`Syncing issues with label: ${label}`);

  await gitRest.iterateAllIssues({
    action: (issue) => syncLabel(issue, label),
    state: "open",
    label_filter: label,
    per_page: 100,
  });
}

async function syncLabel(issue: Issue, label: string): Promise<ActionResponse> {
  gitRest.dispatchMondayWorkflow({
    issue,
    inputs: {
      label_action: "added",
      label_name: label,
    },
  });

  return "triggered";
}

await Promise.all([
  findAndSyncLabel("breaking change"),
  findAndSyncLabel("future breaking change"),
]);
