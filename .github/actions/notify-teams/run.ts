import { notifyTeams } from "./notify.ts";

function assertRequired<T extends readonly unknown[]>(
  array: T,
  core: import("github-script").AsyncFunctionArguments["core"],
  errorMessage?: string,
): { [K in keyof T]: NonNullable<T[K]> } {
  if (array.some((item) => item === undefined || item === null)) {
    core.warning(
      errorMessage || `One or more required items are not defined, exiting.`,
      {
        title: "Assert Required",
      },
    );
    process.exit(0);
  }

  return array as { [K in keyof T]: NonNullable<T[K]> };
}

/**
 * Sends a Teams notification using environment variables for the message parameters.
 *
 * Used as the entry for the composite action.
 */
export default async function run(
  core: import("github-script").AsyncFunctionArguments["core"],
) {
  const { WEBHOOK_URI, MESSAGE_TITLE, MESSAGE_BODY, ACTION_TEXT, ACTION_URL } =
    process.env;

  const [webhook_uri, title, body, action_text, action_url] = assertRequired(
    [WEBHOOK_URI, MESSAGE_TITLE, MESSAGE_BODY, ACTION_TEXT, ACTION_URL],
    core,
  );

  const { error } = await notifyTeams({
    webhook_uri,
    title,
    body,
    action_text,
    action_url,
  });

  if (error) {
    core.setFailed(`Failed to send Teams notification. ${error}`);
  }
}
