import GitRest from "../src/utils/git-rest";
import type { ActionResponse, Issue } from "../src/types";

const owner = "Esri";
const repo = "calcite-design-system";

// Used to sync Devtopia issues
// const owner = "ArcGISDevelopers";
// const repo = "calcite-documentation";

const gitRest = GitRest({ owner, repo });

gitRest.iterateAllIssues({
  action: (issue) => syncMilestone(issue),
  state: "open",
  per_page: 50,
  sleepMs: 60000,
  milestone: "*",
});

async function syncMilestone(issue: Issue): Promise<ActionResponse> {
  if (!issue.milestone) {
    return "skipped";
  }

  gitRest.dispatchMondayWorkflow({
    issue,
    // Used to sync Devtopia issues
    // ref: "next",
    inputs: {
      milestone_updated: "true",
    },
  });

  return "triggered";
}
