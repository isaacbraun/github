import { type Endpoints } from "@octokit/types";

/** The list of issues returned from the GitHub API for a repository. */
export type IssuesList =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]["data"];
/** A GitHub issue or pull request, including its labels and other metadata. */
export type Issue = IssuesList[number];
export type Label = Exclude<Issue["labels"][number], string>;
/** Parameters for fetching issues, including pagination options */
export type PaginateParams =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["parameters"];
export type ActionResponse = "total" | "triggered" | "skipped" | "failed";
export type ActionCounters = {
  [Key in ActionResponse]: number;
};
export type Milestone =
  Endpoints["GET /repos/{owner}/{repo}/milestones"]["response"]["data"][number];

export type Assignee = {
  username: string;
  firstName: string;
  issueCount: number;
};

export interface RestParams {
  /** The owner of the GitHub repository (e.g., "Esri") */
  owner: string;
  /** The name of the GitHub repository (e.g., "calcite-design-system") */
  repo: string;
}

/** Inputs for Monday Sync Workflow */
export interface WorkflowInputs {
  milestone_updated?: "true" | "false";
  assignee_updated?: "true" | "false";
  state_updated?: "open" | "closed";
  label_name?: string;
  label_color?: string | null;
  label_action?: "added" | "removed";
}

export interface IterateParams {
  /** Method to perform on each Issue */
  action: (issue: Issue) => Promise<ActionResponse>;
  /** The category of items to iterate over: "issue" or "pull_request" (default: "issue") */
  category?: "issue" | "pull_request";
  /** Filter issues by state: "open", "closed", or "all" (default: "open") */
  state?: PaginateParams["state"];
  /** Filter issues by assignee: Can be the name of a user, `"none"` for issues with no assigned user, and `"*"` for issues assigned to any user. */
  assignee?: PaginateParams["assignee"];
  /** Filter issues by milestone title */
  milestone?: PaginateParams["milestone"];
  /** Filter issues that have all specified labels (comma-separated string?) */
  label_filter?: PaginateParams["labels"];
  /** Number of issues to fetch per page (default: 30) */
  per_page?: number;
  /** Milliseconds to sleep between page fetches (default: 0) */
  sleepMs?: number;
  /** If true, only fetch and process the first page of results (default: false) */
  onlyFirstPage?: boolean;
}
