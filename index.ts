import Rest from "./rest";
import { type WorkflowInputs } from "./types";

const owner = "Esri";
const repo = "calcite-design-system";
const rest = Rest({ owner, repo });

const inputs: WorkflowInputs = {
  // label_name: label,
  // label_action: "added",
  // assignee_updated: "true",
}

await rest.iterateAllIssues({
  action: (issue) => rest.dispatchMondayWorkflow(issue, inputs),
  per_page: 100,
});
