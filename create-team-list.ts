import { serve } from "bun";
import Rest from "./rest";
import { teamMap } from "./resources";

const owner = "Esri";
const repo = "calcite-design-system";
const milestone = "186";
const rest = Rest({ owner, repo });
const createAssignedURL = (username: string) =>
  `https://github.com/${owner}/${repo}/issues?q=sort%3Aupdated-desc%20is%3Aissue%20state%3Aopen%20-label%3A%224%20-%20installed%22%20assignee%3A${username}%20milestone%3A${encodeURIComponent(milestone)}`;

async function createAssigneeItems(): Promise<string> {
  const items = await Promise.all(
    teamMap.map(async ({ username, firstName }) => {
      const issues = await rest.getAllIssues({ owner, repo, assignee: username, milestone });

      if (issues.length === 0) {
        return `<li>${firstName} - 0</li>`;
      } else {
        return `
        <li>
          <a href="${createAssignedURL(username)}" target="_blank">${firstName}</a> - ${issues.length}
        </li>
      `;
      }
    }),
  );

  return items.join("");
}

async function Page(): Promise<string> {
  return `
    <!doctype html>
    <html>
      <head>
        <title>Calcite Team Assignments</title>
      </head>
      <body>
        <ul>
        ${await createAssigneeItems()}
        </ul>
      </body>
    </html>
  `;
}

const server = serve({
  port: 3001,
  async fetch() {
    return new Response(await Page(), {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Server running at ${server.url}`);
