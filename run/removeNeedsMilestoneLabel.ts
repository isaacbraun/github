import GitRest from "../src/utils/git-rest";
import { milestones } from "../src/resources";
import type { Issue } from "../src/types";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

await gitRest.iterateAllIssues({
  action: (issue) => processRemovingNeedsMilestoneLabel(issue),
  state: "all",
  per_page: 100,
  sleepMs: 30000 
});

async function processRemovingNeedsMilestoneLabel(issue: Issue) {
  const { backlog: {number: backlogMilestoneNumber} } = milestones;
  const { labels, number: issue_number } = issue;
  const needsMilestoneLabel = "needs milestone";

  const hasNeedsMilestoneLabel = labels.some((label) => {
    if (typeof label === "string") {
      return label.toLowerCase() === needsMilestoneLabel.toLowerCase();
    }
    return label.name?.toLowerCase() === needsMilestoneLabel.toLowerCase();
  });

  if (!hasNeedsMilestoneLabel) {
    console.log(`No "${needsMilestoneLabel}" label found in issue #${issue_number}. Skipping...`);
    return "skipped";
  }

  // Remove the specified label from the issue
  try {
    await gitRest.octokit.request(
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
      {
        owner,
        repo,
        issue_number,
        name: needsMilestoneLabel.toLocaleLowerCase(),
      }
    );
    console.log(`Removed label "${needsMilestoneLabel}" from issue #${issue_number}.`);
  } catch (error) {
    console.error(`Error removing label "${needsMilestoneLabel}" from issue #${issue_number}: ${error}`);
  }

  // Place in the "Backlog" milestone if it doesn't already have a milestone
  await gitRest.addMilestone(issue, backlogMilestoneNumber, false);

  return "triggered";
}