import GitRest from "./src/utils/git-rest";
import { unrelatedMergedPrs } from "./src/utils/issue-functions";

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
