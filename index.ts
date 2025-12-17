import Rest from "./rest";
import { type WorkflowInputs } from "./types";

const owner = "Esri";
const repo = "calcite-design-system";
const rest = Rest({ owner, repo });

const label = "i18n-l10n";
const inputs: WorkflowInputs = {
  label_name: label,
  label_action: "added",
}

await rest.iterateAllIssues({
  action: (issue) => rest.dispatchMondayWorkflow(issue, inputs),
  label_filter: label,
  per_page: 100,
});
