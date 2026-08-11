import { config } from "../config.js";
import { log } from "../logger.js";

const API_ROOT = "https://api.github.com";

export function isGithubConfigured() {
  return Boolean(config.githubToken && config.githubRepo);
}

/**
 * Opens an issue on the configured repo. Returns the created issue's number
 * and html_url. Throws with a readable message so the admin sees why it failed.
 */
export async function createIssue({ title, body, labels = [] }) {
  if (!isGithubConfigured()) {
    throw new Error("GITHUB_TOKEN or GITHUB_REPO isn't set");
  }

  const url = `${API_ROOT}/repos/${config.githubRepo}/issues`;
  log("github", `creating issue on ${config.githubRepo}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // 404 on a repo that exists almost always means the token can't see it —
    // usually a fine-grained token still pending org approval.
    const hint =
      response.status === 404
        ? " (token may lack access to the repo, or is pending org approval)"
        : "";
    log("github", `issue creation failed: ${response.status} ${detail.slice(0, 200)}`);
    throw new Error(`GitHub returned ${response.status}${hint}`);
  }

  const issue = await response.json();
  log("github", `created issue #${issue.number}: ${issue.html_url}`);
  return issue;
}
