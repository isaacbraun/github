import GitRest from "../src/utils/git-rest";
import { processRemovingNeedsMilestoneLabel } from "../src/utils/issue-functions";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

await gitRest.iterateAllIssues({
  action: (issue) => processRemovingNeedsMilestoneLabel(issue, owner, repo),
  state: "all",
  per_page: 100,
  sleepMs: 3000 
});