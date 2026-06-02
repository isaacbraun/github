import GitRest from "../src/utils/git-rest";
import type { ActionResponse, Issue } from "../src/types";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

await gitRest.iterateAllIssues({
  action: (issue) => unrelatedMergedPrs(issue),
  state: "closed",
  category: "pull_request",
  label_filter: "refactor",
  per_page: 100,
});

async function unrelatedMergedPrs(
  issue: Issue,
): Promise<ActionResponse> {
  if (
    !issue.pull_request?.merged_at ||
    issue.pull_request?.merged_at <= new Date("2025-09-16").toISOString()
  ) {
    return "failed";
  }
  if (issue.body?.match(/\*\*Related Issue:\*\* #(\d+)/)) {
    // Has related issue
    return "skipped";
  }
  // No related issue in body
  gitRest.dispatchMondayWorkflow(issue, { refactor_pr: "true" });
  return "triggered";
}