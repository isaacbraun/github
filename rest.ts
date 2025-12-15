import { Octokit } from "@octokit/rest";
import { type Endpoints } from "@octokit/types";
import { sleep } from "bun";

type IssuesList =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]["data"];
type Issue = IssuesList[number];
type Label = Exclude<Issue["labels"][number], string>;
type PaginateParams =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["parameters"];
type ActionResponse = "total" | "triggered" | "skipped" | "failed";
type ActionCounters = {
  [Key in ActionResponse]: number;
};

interface RestParams {
  owner: string;
  repo: string;
}

export default function Rest({ owner, repo }: RestParams) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  /**
   * Get all Esri Product Labels (color: #006B75) from an issue
   * @param issue - The GitHub issue object
   * @returns An array of Esri Product Labels or an empty array if none found
   */
  function getProductLabels(issue: Issue): Label[] {
    return issue.labels.filter(
      (label): label is Label =>
        typeof label !== "string" && label.color === "006B75",
    );
  }

  /**
   * Remove pull requests from a list of issues
   * @param issues - An array of GitHub issues
   * @returns An array of issues excluding pull requests
   */
  function removePullRequests(issues: IssuesList): Issue[] {
    return issues.filter((issue) => !issue.pull_request);
  }

  interface WorkflowInputs {
    milestone_updated?: "true" | "false";
    assignee_updated?: "true" | "false";
    state_updated?: "open" | "closed";
    label_name?: string;
    label_color?: string | null;
    label_action?: "added" | "removed";
  }
  /**
   * Dispatch a GitHub Actions workflow for the given issue
   * @param issue - The GitHub issue object
   * @param inputs - The inputs for the workflow dispatch
   * @returns ActionResponse indicating the result of the operation
   */
  async function dispatchMondayWorkflow(
    issue: Issue,
    inputs: WorkflowInputs,
  ): Promise<ActionResponse> {
    const defaultInputs = {
      issue_number: issue.number.toString(),
      event_type: "SyncActionChanges",
    };

    try {
      await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: "issue-monday-sync.yml",
        ref: "dev",
        inputs: { ...defaultInputs, ...inputs },
      });
      console.log(`DISPATCHED: ${issue.html_url}`);
      return "triggered";
    } catch (error) {
      console.error(
        `FAILED: ${issue.html_url}. Error: ${String(error)}`,
        error,
      );
      return "failed";
    }
  }

  /**
   * Sync Esri Product Labels to Monday.com via GitHub Actions workflow dispatch
   * @param issue - The GitHub issue object
   * @returns ActionResponse indicating the result of the operation
   */
  async function syncEsriProductLabels(issue: Issue): Promise<ActionResponse> {
    const productLabels = getProductLabels(issue);
    if (productLabels.length === 0) return "skipped";

    const firstLabel = productLabels[0];
    if (!firstLabel?.name) {
      console.warn(`FAILED: ${issue.html_url}. No valid label found.`);
      return "failed";
    }

    const inputs: WorkflowInputs = {
      label_name: firstLabel.name,
      label_color: firstLabel.color,
      label_action: "added",
    };

    return await dispatchMondayWorkflow(issue, inputs);
  }

  interface IterateParams {
    action: (issue: Issue) => Promise<ActionResponse>;
    state?: PaginateParams["state"];
    milestone?: PaginateParams["milestone"];
    per_page?: number;
    sleepMs?: number;
    onlyFirstPage?: boolean;
  }
  /**
   * Iterate over all issues in the repository and perform the specified action
   */
  async function iterateAllIssues({
    action,
    state = "open",
    milestone,
    per_page = 30,
    sleepMs = 0,
    onlyFirstPage = false,
  }: IterateParams): Promise<void> {
    const counters: ActionCounters = {
      total: 0,
      triggered: 0,
      skipped: 0,
      failed: 0,
    };

    let iteratorOptions: PaginateParams = { owner, repo, per_page, state };
    if (milestone) {
      iteratorOptions = { ...iteratorOptions, milestone };
    }

    for await (const page of octokit.paginate.iterator(
      "GET /repos/{owner}/{repo}/issues",
      iteratorOptions,
    )) {
      const issues = removePullRequests(page.data);
      counters.total += issues.length;

      for (const issue of issues) {
        const result = await action(issue);
        counters[result] += 1;
      }

      if (onlyFirstPage) break;

      console.log(`Sleeping for ${sleepMs} ms before next page...`);
      await sleep(sleepMs);
    }
    console.log(
      `\n --- Issues processed --- \n
      Total: ${counters.total} \n
      Triggered: ${counters.triggered} \n
      Skipped: ${counters.skipped} \n
      Failed: ${counters.failed} \n`,
    );
  }

  /**
   * Sync assignees to Monday.com via GitHub Actions workflow dispatch
   * @param issue - The GitHub issue object
   * @returns ActionResponse indicating the result of the operation
   */
  async function syncAssignees(issue: Issue): Promise<ActionResponse> {
    if (issue?.assignees?.length === 0) return "skipped";

    return await dispatchMondayWorkflow(issue, { assignee_updated: "true" });
  }

  /**
   * Fetch a single issue by its number
   * @param issue_number - The number of the issue to fetch
   * @returns The GitHub issue object
   */
  async function getIssue(issue_number: number): Promise<Issue> {
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number,
    });
    return issue;
  }

  return {
    octokit,
    getIssue,
    syncAssignees,
    getProductLabels,
    removePullRequests,
    syncEsriProductLabels,
    iterateAllIssues,
  };
}
