import GitRest from "./src/utils/git-rest";
import { type WorkflowInputs } from "./src/types";
import { unrelatedMergedPrs } from "./src/utils/issue-functions";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

const inputs: WorkflowInputs = {
  // label_name: label,
  // label_action: "added",
  // assignee_updated: "true",
};

await gitRest.iterateAllIssues({
  action: (issue) => unrelatedMergedPrs(issue),
  state: "closed",
  category: "pull_request",
  label_filter: "refactor",
  per_page: 100,
});
