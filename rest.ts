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
}

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

  async function syncEsriProductLabels(issue: Issue): Promise<ActionResponse> {
    const productLabels = getProductLabels(issue);
    if (productLabels.length === 0) return "skipped";

    const firstLabel = productLabels[0];
    if (!firstLabel?.name) {
      console.warn(`FAILED: ${issue.html_url}. No valid label found.`);
      return "failed";
    }

    try {
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
        `DISPATCHED: ${issue.html_url}`,
      );
      return "triggered";
    } catch (error) {
      console.error(
        `FAILED: ${issue.html_url}. Error: ${String(error)}`,
        error,
      );
      return "failed";
    }
  }

  interface IterateParams {
    action: (issue: Issue) => Promise<ActionResponse>;
    state?: PaginateParams["state"];
    milestone?: PaginateParams["milestone"];
    per_page?: number;
    sleepMs?: number;
    onlyFirstPage?: boolean;
  }
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
      await sleep(sleepMs); // To avoid rate limiting
    }
    console.log(
      `\n --- Issues processed --- \n
      Total: ${counters.total} \n
      Triggered: ${counters.triggered} \n
      Skipped: ${counters.skipped} \n
      Failed: ${counters.failed} \n`,
    );
  }

  return {
    octokit,
    getProductLabels,
    removePullRequests,
    syncEsriProductLabels,
    iterateAllIssues,
  };
}
