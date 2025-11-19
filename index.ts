import Rest from "./rest";

const owner = "Esri";
const repo = "calcite-design-system";
const rest = Rest({ owner, repo });

await rest.iterateAllIssues({
  action: rest.syncEsriProductLabels,
  per_page: 100,
});

// rest.octokit.rest.issues
//   .get({
//     owner,
//     repo,
//     issue_number: 12909,
//   })
//   .then((response) => {
//     rest.syncEsriProductLabels(response.data);
//   });
