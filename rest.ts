import { Octokit } from "@octokit/rest";
import { type Endpoints } from "@octokit/types";

type IssuesList =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]["data"];
type Issue = IssuesList[number];
type Label = Exclude<Issue["labels"][number], string>;

interface RestParams {
  owner: string;
  repo: string;
}

export default function Rest({ owner, repo }: RestParams) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  function getProductLabels(issue: Issue): Label[] {
    return issue.labels.filter(
      (label): label is Label =>
        typeof label !== "string" && label.color === "006B75",
    );
  }

  function removePullRequests(issues: IssuesList): Issue[] {
    return issues.filter((issue) => !issue.pull_request);
  }

  async function syncEsriProductLabels(issue: Issue): Promise<void> {
    const productLabels = getProductLabels(issue);
    if (productLabels.length <= 0) {
      return;
    }

    const firstLabel = productLabels[0];
    if (!firstLabel?.name) {
      console.warn(
        `#${issue.number}: Failed finding label name - ${issue.html_url}`,
      );
      return;
    }

    await octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: "issue-monday-sync.yml",
      ref: "dev",
      inputs: {
        issue_number: issue.number.toString(),
        event_type: "SyncActionChanges",
        label_name: firstLabel.name,
        label_color: firstLabel.color,
        label_action: "added",
      },
    });
    console.log(
      `#${issue.number}: Syncing ${firstLabel.name} - ${issue.html_url}`,
    );
  }

  interface IterateParams {
    action: (issue: Issue) => Promise<void> | void;
    per_page?: number;
    onlyFirstPage?: boolean;
  }
  async function iterateAllIssues({
    action,
    per_page = 30,
    onlyFirstPage = false,
  }: IterateParams): Promise<void> {
    try {
      for await (const page of octokit.paginate.iterator(
        "GET /repos/{owner}/{repo}/issues",
        {
          owner,
          repo,
          per_page,
        },
      )) {
        const issues = removePullRequests(page.data);
        issues.forEach(async (issue) => await action(issue));

        if (onlyFirstPage) {
          break;
        }
      }
    } catch (error) {
      console.error("Error fetching product issues:", error);
      throw error;
    }
  }

  return {
    octokit,
    getProductLabels,
    removePullRequests,
    syncEsriProductLabels,
    iterateAllIssues,
  };
}
