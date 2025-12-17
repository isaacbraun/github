import { type Endpoints } from "@octokit/types";

export type IssuesList =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["response"]["data"];
export type Issue = IssuesList[number];
export type Label = Exclude<Issue["labels"][number], string>;
export type PaginateParams =
  Endpoints["GET /repos/{owner}/{repo}/issues"]["parameters"];
export type ActionResponse = "total" | "triggered" | "skipped" | "failed";
export type ActionCounters = {
  [Key in ActionResponse]: number;
};

export interface RestParams {
  owner: string;
  repo: string;
}

export interface WorkflowInputs {
  milestone_updated?: "true" | "false";
  assignee_updated?: "true" | "false";
  state_updated?: "open" | "closed";
  label_name?: string;
  label_color?: string | null;
  label_action?: "added" | "removed";
}

export interface IterateParams {
  action: (issue: Issue) => Promise<ActionResponse>;
  state?: PaginateParams["state"];
  milestone?: PaginateParams["milestone"];
  label_filter?: PaginateParams["labels"];
  per_page?: number;
  sleepMs?: number;
  onlyFirstPage?: boolean;
}
