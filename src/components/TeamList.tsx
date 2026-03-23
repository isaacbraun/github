import { useState } from "react";
import {
  useQuery,
  useMutation,
  QueryClient,
  QueryClientProvider,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import { teamMap } from "../resources";
import type { Milestone } from "../types";

const owner = "Esri";
const repo = "calcite-design-system";
const queryClient = new QueryClient();

type Assignee = {
  username: string;
  firstName: string;
  issueCount: number;
};

async function getMilestoneAssignees({
  queryKey,
}: QueryFunctionContext): Promise<{
  milestone: Milestone | null;
  assignees: Assignee[];
}> {
  const [_key, { randomize }] = queryKey;
  const response = await fetch(
    "/api/milestone-assignees" + (randomize ? "?randomize=true" : ""),
  );
  if (!response.ok) {
    throw new Error("Failed to load milestone assignees");
  }
  const data = (await response.json()) as {
    milestone: Milestone | null;
    assignees: Assignee[];
  };

  return data;
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

function AssigneeList(): JSX.Element {
  const [randomize, setRandomize] = useState(false);
  const query = useQuery({
    queryKey: ["assignees", { randomize }],
    queryFn: getMilestoneAssignees,
  });

  return (
    <>
      <button
        onClick={() => {
          setRandomize(true);
          query.refetch();
        }}
      >
        Randomize
      </button>
      {query.isLoading && <p>Loading...</p>}
      {query.isRefetching && <p>Randomizing...</p>}
      <ul>
        {query.data?.assignees.map((assignee) => (
          <AssigneeItem
            key={assignee.username}
            assignee={assignee}
            milestoneTitle={
              query.data?.milestone
                ? query.data.milestone.title
                : "No Milestone"
            }
          />
        ))}
      </ul>
    </>
  );
}

export default function TeamList() {
  return (
    <QueryClientProvider client={queryClient}>
      <AssigneeList />
    </QueryClientProvider>
  );
}
