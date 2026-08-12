type NotifyTeams = {
  /** The Microsoft Teams webhook URI to send the message to. */
  webhook_uri: string;
  /** The message title. */
  title: string;
  /** The message body. Supports simple markdown formatting. */
  body?: string;
  /** The text of the action button. */
  action_text?: string;
  /** The URL of the action button. */
  action_url?: string;
};

type CardContent = {
  type: "AdaptiveCard";
  $schema: string;
  version: string;
  body: {
    type: string;
    text?: string;
    size?: "Large";
    weight?: "Bolder";
    color?: "Accent";
    wrap?: boolean;
  }[];
  actions: {
    type: "Action.OpenUrl";
    title: string;
    url: string;
  }[];
};

/**
 * Sends an `AdaptiveCard` message to a specifed Microsoft Teams channel via webhook.
 * @returns An object with an error message if the request failed, or null if it
 * succeeded.
 */
export async function notifyTeams({ webhook_uri, title, body, action_text, action_url }: NotifyTeams) {
  const teamsCard = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.2",
          body: [
            {
              type: "TextBlock",
              text: title,
              size: "Large",
              weight: "Bolder",
              color: "Accent",
              wrap: true,
            },
          ],
        } as CardContent,
      },
    ],
  };

  if (body) {
    teamsCard.attachments[0].content.body.push({
      type: "TextBlock",
      text: body,
      wrap: true,
    });
  }

  if (action_text && action_url) {
    teamsCard.attachments[0].content.actions = [
      {
        type: "Action.OpenUrl",
        title: action_text,
        url: action_url,
      },
    ];
  }

  return fetch(webhook_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(teamsCard),
  })
    .then(async (response) => {
      return { error: !response.ok ? `${response.status}: ${await response.text()}` : null };
    })
    .catch((error) => {
      return { error: `Failed to send Teams notification. ${error}` };
    });
}

