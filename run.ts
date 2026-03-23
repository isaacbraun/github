import GitRest from "./src/utils/git-rest";
import { type WorkflowInputs } from "./src/types";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

const inputs: WorkflowInputs = {
  // label_name: label,
  // label_action: "added",
  // assignee_updated: "true",
}

await gitRest.iterateAllIssues({
  action: (issue) => gitRest.dispatchMondayWorkflow(issue, inputs),
  per_page: 100,
});
