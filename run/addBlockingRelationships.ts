import type { ActionResponse, Issue } from "../src/types";
import GitRest from "../src/utils/git-rest";

const owner = "Esri";
const repo = "calcite-design-system";
const gitRest = GitRest({ owner, repo });

await gitRest.iterateAllIssues({
  action: (issue) => processBlockingRelationships(issue, owner, repo),
  state: "all",
  per_page: 100,
  sleepMs: 3000
});

async function processBlockingRelationships(issue: Issue, owner: string, repo: string): Promise<ActionResponse> {
  const { body, number: issue_number } = issue;

  if (!body) {
    console.log(`Could not determine the issue body for #${issue_number}.`);
    return "skipped";
  }

  const blockedIssuesLineRegex = /Blocked issues:\s*([^\n]+)/i;
  const issueRegex = /#(\d+)|https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/g;
  const blockedIssuesLineMatch = body.match(blockedIssuesLineRegex);
  const blockedIssueNumbers = new Set<number>();

  if (!blockedIssuesLineMatch || !blockedIssuesLineMatch[1]) {
    console.log(`No blocked issues line found in issue #${issue_number}. Skipping...`);
    return "skipped";
  }

  const blockedLine = blockedIssuesLineMatch[1];

  let match;
  while ((match = issueRegex.exec(blockedLine)) !== null) {
    const matchedIssueNumber = Number(match[1] || match[2]);
    if (matchedIssueNumber && matchedIssueNumber !== issue_number) {
      blockedIssueNumbers.add(matchedIssueNumber);
    }
  }

  if (blockedIssueNumbers.size === 0) {
    console.log(`No valid blocked issues found in issue #${issue_number}. Skipping...`);
    return "skipped";
  }

  // Add relationships
  for (const blockedIssueNumber of blockedIssueNumbers) {
    try {
      console.log(`Marking issue #${issue_number} as blocking issue #${blockedIssueNumber}...`);
      await gitRest.octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by",
        {
          owner,
          repo,
          issue_number: blockedIssueNumber,
          issue_id: issue.id,
        }
      );
    } catch (error) {
      console.error(`Error adding relationship for #${blockedIssueNumber}: ${error}`);
    }
  }

  // Remove the line from description
  const newBody = body.replace(/Blocked issues:\s*[^\n]+\n[^\n]*\n/i, "").trim();
  try {
    await gitRest.octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
      {
        owner,
        repo,
        issue_number,
        body: newBody,
      }
    );
    console.log(`Removed blocked issues line from issue #${issue_number}.`);
  } catch (error) {
    console.error(`Error updating issue #${issue_number}: ${error}`);
  }

  return "triggered";
}
