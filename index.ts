import Rest from "./rest";

const owner = "Esri";
const repo = "calcite-design-system";
const rest = Rest({ owner, repo });

await rest.iterateAllIssues({
  action: rest.syncEsriProductLabels,
  per_page: 100,
  sleepMs: 5000,
});
