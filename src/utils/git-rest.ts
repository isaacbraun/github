import { Octokit } from "@octokit/rest";
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
  Milestone,
} from "../types";

export default function GitRest({ owner, repo }: RestParams) {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  /**
   * Get all Esri Product Labels (color: #006B75) from an issue
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
   * @returns An array of issues excluding pull requests
   */
  function getIssueCategory(
    issues: IssuesList,
    category: IterateParams["category"],
  ): Issue[] {
    return issues.filter((issue) =>
      category === "issue" ? !issue.pull_request : !!issue.pull_request,
    );
  }

  /**
   * Dispatch a GitHub Actions workflow for the given issue
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

  async function getMilestones(): Promise<Milestone[]> {
    const { data: milestones } = await octokit.rest.issues.listMilestones({
      owner,
      repo,
      state: "open",
      sort: "due_on",
      direction: "asc",
    });
    return milestones;
  }

  /**
   * Fetch all issues from the repository with pagination
   * @returns An array of GitHub issues
   */
  async function getAllIssues(params: PaginateParams): Promise<Issue[]> {
    const issues: Issue[] = [];

    for await (const page of octokit.paginate.iterator(
      "GET /repos/{owner}/{repo}/issues",
      { ...params, owner, repo },
    )) {
      issues.push(...getIssueCategory(page.data, "issue"));
    }

    return issues;
  }

  /**
   * Iterate over all issues in the repository and perform the specified action
   *
   * @returns A promise that resolves when all issues have been processed
   */
  async function iterateAllIssues({
    action,
    category = "issue",
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
      const issues = getIssueCategory(page.data, category);
      counters.total += issues.length;

      for (const issue of issues) {
        const result = await action(issue);
        counters[result] += 1;
      }

      if (onlyFirstPage) break;

      if (sleepMs > 0) {
        console.log(`Sleeping for ${sleepMs} ms before next page...`);
        await sleep(sleepMs);
      }
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
    getMilestones,
    getProductLabels,
    dispatchMondayWorkflow,
    removePullRequests: getIssueCategory,
    syncEsriProductLabels,
    getAllIssues,
    iterateAllIssues,
  };
}
