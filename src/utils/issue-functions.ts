import { Octokit } from "@octokit/rest";
import type { ActionResponse, Issue } from "../types";
import { teamGroups, milestones } from "../resources";

export async function processBlockingRelationships(issue: Issue, owner: string, repo: string): Promise<ActionResponse> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
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
      await octokit.request(
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
    await octokit.request(
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

export async function processRemovingNeedsMilestoneLabel(issue: Issue, owner: string, repo: string): Promise<ActionResponse> {
  const { backlog: {number: backlogMilestoneNumber} } = milestones;
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
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
    await octokit.request(
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
  await addMilestone(issue, owner, repo, backlogMilestoneNumber, false)

  return "triggered";
}

export async function addMilestone(issue: Issue, owner: string, repo: string, milestoneToAdd: number, replaceExistingMilestone: boolean): Promise<ActionResponse> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  const { number: issue_number } = issue;

  // Check if the issue already has a milestone
  if (issue.milestone && !replaceExistingMilestone) {
    console.log(`Issue #${issue_number} already has a milestone and replaceExistingMilestone is false. Skipping...`);
    return "skipped";
  }

  // Add the specified milestone to the issue
  try {
    await octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
      {
        owner,
        repo,
        issue_number,
        milestone: milestoneToAdd
      }
    );
    console.log(`Added milestone "${milestoneToAdd}" to issue #${issue_number}.`);
  } catch (error) {
    console.error(`Error adding milestone "${milestoneToAdd}" to issue #${issue_number}: ${error}`);
  }
  return "triggered";
}