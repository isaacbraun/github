import GitRest from "../src/utils/git-rest";
import { processBlockingRelationships } from "../src/utils/issue-functions";

const owner = "DitwanP";
const repo = "action-testing";
const gitRest = GitRest({ owner, repo });

await gitRest.iterateAllIssues({
  action: (issue) => processBlockingRelationships(issue, owner, repo),
  state: "all",
  per_page: 100,
  sleepMs: 3000 
});