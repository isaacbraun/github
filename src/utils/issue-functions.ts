import type { ActionResponse, Issue } from "../types";

export async function unrelatedMergedPrs(
  issue: Issue,
): Promise<ActionResponse> {
  if (
    !issue.pull_request?.merged_at ||
    issue.pull_request?.merged_at <= new Date("2025-09-16").toISOString()
  ) {
    return "failed";
  }
  if (issue.body?.match(/\*\*Related Issue:\*\* #(\d+)/)) {
    // Has related issue
    return "skipped";
  }
  // No related issue in body
  return "triggered";
}
