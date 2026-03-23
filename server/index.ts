import { teamMap } from "../src/resources";
import type { Milestone } from "../src/types";
import GitRest from "../src/utils/git-rest";

const app = Bun.serve({
  port: 8787,
  routes: {
    "/api/milestone-assignees": async (req) => {
      const url = new URL(req.url);
      const randomize = url.searchParams.get("randomize") || "";
      const gitConfig = { owner: "Esri", repo: "calcite-design-system" };
      const randomizedTeamMap =
        randomize !== "" ? teamMap.sort(() => Math.random() - 0.5) : teamMap;
      const gitRest = GitRest(gitConfig);

      try {
        const milestones = await gitRest.getMilestones();
        const currentMilestone: Milestone | undefined = milestones.find(
          (m) => m.due_on !== null,
        );

        if (!currentMilestone) {
          console.warn("No open milestones found.");
          return Response.json({
            milestone: null,
            assignees: randomizedTeamMap.map(({ username, firstName }) => ({
              username,
              firstName,
              issueCount: 0,
            })),
          });
        }

        const assignees = await Promise.all(
          randomizedTeamMap.map(async ({ username, firstName }) => {
            const issues = await gitRest.getAllIssues({
              owner: gitConfig.owner,
              repo: gitConfig.repo,
              assignee: username,
              milestone: String(currentMilestone.number),
            });
            const issueCount = issues.filter((issue) => {
              return !issue.labels.some(
                (label) =>
                  typeof label === "object" && label.name === "4 - installed",
              );
            }).length;

            return { username, firstName, issueCount };
          }),
        );

        return Response.json({
          milestone: currentMilestone,
          assignees,
        });
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 });
      }
    },
  },
});

console.log(`Bun API listening on http://localhost:${app.port}`);
