import { Octokit } from "@octokit/rest";
import { sleep } from "bun";
import type {
  RestParams,
  Issue,
  Label,
  IssuesList,
  IterateParams,
  ActionCounters,
  WorkflowInputs,
  ActionResponse,
  PaginateParams,
} from "./types";

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

  /**
   * Iterate over all issues in the repository and perform the specified action
   *
   * @param action - Method to perform on each Issue, returns a promise of ActionResponse
   * @param state - Filter issues by state: "open", "closed", or "all" (default: "open")
   * @param assignee - Filter issues by assignee: Can be the name of a user, `"none"` for issues with no assigned user, and `"*"` for issues assigned to any user.
   * @param milestone - Filter issues by milestone title
   * @param label_filter - Filter issues that have all specified labels (comma-separated string?)
   * @param per_page - Number of issues to fetch per page (default: 30)
   * @param sleepMs - Milliseconds to sleep between page fetches (default: 0)
   * @param onlyFirstPage - If true, only fetch and process the first page of results (default: false)
   * @returns A promise that resolves when all issues have been processed
   */
  async function iterateAllIssues({
    action,
    state = "open",
    assignee,
    milestone,
    label_filter,
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
    if (assignee) {
      iteratorOptions = { ...iteratorOptions, assignee };
    }
    if (milestone) {
      iteratorOptions = { ...iteratorOptions, milestone };
    }
    if (label_filter) {
      iteratorOptions = { ...iteratorOptions, labels: label_filter };
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
    dispatchMondayWorkflow,
    removePullRequests,
    syncEsriProductLabels,
    iterateAllIssues,
  };
}
