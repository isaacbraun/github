import { serve } from "bun";
import { renderToStaticMarkup } from "react-dom/server";
import Rest from "./rest";
import { teamMap } from "./resources";
import type { Milestone } from "./types";

const owner = "Esri";
const repo = "calcite-design-system";
const rest = Rest({ owner, repo });

type Assignee = {
  username: string;
  firstName: string;
  issueCount: number;
};

async function getMilestoneAssignees(): Promise<{
  milestone: Milestone | null;
  assignees: Assignee[];
}> {
  const milestones = await rest.getMilestones();
  const currentMilestone: Milestone | undefined = milestones.find(
    (m) => m.due_on !== null,
  );

  if (!currentMilestone) {
    console.warn("No open milestones found.");
    return {
      milestone: null,
      assignees: teamMap.map(({ username, firstName }) => ({
        username,
        firstName,
        issueCount: 0,
      })),
    };
  }

  const assignees = await Promise.all(
    teamMap.map(async ({ username, firstName }) => {
      const issues = await rest.getAllIssues({
        owner,
        repo,
        assignee: username,
        milestone: String(currentMilestone.number),
      });

      const issueCount = issues.filter((issue) => {
        return (
          !issue.labels.some(
            (label) =>
              typeof label === "object" && label.name === "4 - installed",
          ))
      }
      ).length;

      return { username, firstName, issueCount };
    }),
  );

  return { milestone: currentMilestone, assignees };
}

function AssigneeItem({
  assignee,
  milestoneTitle,
}: {
  assignee: Assignee;
  milestoneTitle: string;
}) {
  const { username, firstName, issueCount } = assignee;

  if (issueCount === 0) {
    return <li>{firstName} - 0</li>;
  }

  const createURL = () =>
    `https://github.com/${owner}/${repo}/issues?q=sort%3Aupdated-desc%20is%3Aissue%20state%3Aopen%20-label%3A%224%20-%20installed%22%20assignee%3A${username}%20milestone%3A${encodeURIComponent(`"${milestoneTitle}"`)}`;

  return (
    <li>
      <a href={createURL()} target="_blank" rel="noreferrer">
        {firstName}
      </a>
      {" - "}
      {issueCount}
    </li>
  );
}

function AssigneeList({
  assignees,
  milestone,
}: {
  assignees: Assignee[];
  milestone: Milestone | null;
}) {
  return (
    <ul>
      {assignees.map((assignee) => (
        <AssigneeItem
          key={assignee.username}
          assignee={assignee}
          milestoneTitle={milestone ? milestone.title : "No Milestone"}
        />
      ))}
    </ul>
  );
}

function Page({
  assignees,
  milestone,
}: {
  assignees: Assignee[];
  milestone: Milestone | null;
}) {
  return (
    <html>
      <head>
        <title>Calcite Team Assignments</title>
      </head>
      <body>
        <AssigneeList assignees={assignees} milestone={milestone} />
      </body>
    </html>
  );
}

async function renderPage(): Promise<string> {
  const { milestone, assignees } = await getMilestoneAssignees();
  return `<!doctype html>${renderToStaticMarkup(<Page assignees={assignees} milestone={milestone} />)}`;
}

const server = serve({
  port: 3001,
  async fetch() {
    return new Response(await renderPage(), {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Server running at ${server.url}`);
