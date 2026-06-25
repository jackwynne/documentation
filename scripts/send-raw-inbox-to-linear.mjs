#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DEFAULT_LABEL = "raw-inbox";
const DEFAULT_LINEAR_SENT_LABEL = "linear-sent";
const MARKER = "<!-- linear-codex-task -->";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || getGitHubCliToken();
const linearToken = process.env.LINEAR_API_KEY || process.env.LINEAR_TOKEN;
const repo = args.repo || process.env.GITHUB_REPOSITORY || inferRepoFromGitRemote();
const label = args.label || process.env.RAW_INBOX_LABEL || DEFAULT_LABEL;
const sentLabel = args.sentLabel || process.env.LINEAR_SENT_LABEL || DEFAULT_LINEAR_SENT_LABEL;
const limit = Number.parseInt(args.limit || "50", 10);

if (!repo) {
  fail("Could not infer the GitHub repository. Pass --repo owner/repo or set GITHUB_REPOSITORY.");
}

if (!githubToken) {
  fail("Missing GitHub auth. Set GITHUB_TOKEN/GH_TOKEN, or run `gh auth login`.");
}

if (!linearToken) {
  console.log("LINEAR_API_KEY is not set; skipping Linear handoff.");
  process.exit(0);
}

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  fail("--limit must be an integer from 1 to 100.");
}

const linearTeamId = await resolveLinearTeamId();

if (!linearTeamId) {
  console.log("LINEAR_TEAM_ID or LINEAR_TEAM_KEY is not set; skipping Linear handoff.");
  process.exit(0);
}

await ensureGitHubLabel(repo, sentLabel, "1D76DB", "Raw capture sent to Linear/Codex.");

const issues = await listGitHubIssues(repo, label, limit);
const captures = issues.filter((issue) => !issue.pull_request);

if (captures.length === 0) {
  console.log(`No open GitHub issues found for ${repo} with label "${label}".`);
  process.exit(0);
}

let sent = 0;
let skipped = 0;

for (const issue of captures) {
  const comments = await listGitHubComments(repo, issue.number);
  const existing = comments.find((comment) => comment.body?.includes(MARKER));

  if (existing) {
    skipped += 1;
    console.log(`skip issue #${issue.number}; already sent to Linear`);
    continue;
  }

  const linearIssue = await createLinearIssue(issue, linearTeamId, repo);
  await createLinearComment(linearIssue.id, issue, repo);

  await createGitHubComment(repo, issue.number, `${MARKER}
Sent to Linear/Codex: ${linearIssue.url}

Linear issue: ${linearIssue.identifier}`);
  await addGitHubLabels(repo, issue.number, [sentLabel]);

  sent += 1;
  console.log(`sent issue #${issue.number} to Linear as ${linearIssue.identifier}`);
}

console.log(`Sent ${sent}, skipped ${skipped}.`);

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[i + 1];

      if (!value || value.startsWith("--")) {
        fail(`Missing value for ${arg}.`);
      }

      parsed[key] = value;
      i += 1;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Send GitHub issues labeled "${DEFAULT_LABEL}" to Linear and mention @Codex.

Usage:
  pnpm raw:send-linear [options]

Environment:
  LINEAR_API_KEY       Required to create Linear issues.
  LINEAR_TEAM_ID       Linear team UUID. Preferred.
  LINEAR_TEAM_KEY      Linear team key, used when LINEAR_TEAM_ID is omitted.
  GITHUB_TOKEN/GH_TOKEN or active gh auth login for GitHub issue comments/labels.

Options:
  --repo owner/repo           Repository to read from. Defaults to GITHUB_REPOSITORY or git remote origin.
  --label name                Source label. Default: ${DEFAULT_LABEL}
  --sent-label name           Label added after sending. Default: ${DEFAULT_LINEAR_SENT_LABEL}
  --limit number              Issues to fetch, 1-100. Default: 50
  --help                      Show this help.
`);
}

async function resolveLinearTeamId() {
  if (process.env.LINEAR_TEAM_ID) {
    return process.env.LINEAR_TEAM_ID;
  }

  const teamKey = process.env.LINEAR_TEAM_KEY;

  if (!teamKey) {
    return null;
  }

  const data = await linearGraphql(`
    query Teams {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `);

  const team = data.teams.nodes.find((item) => item.key.toLowerCase() === teamKey.toLowerCase());

  if (!team) {
    fail(`Could not find Linear team with key "${teamKey}".`);
  }

  return team.id;
}

async function createLinearIssue(issue, teamId, repoName) {
  const data = await linearGraphql(
    `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `,
    {
      input: {
        teamId,
        title: issue.title,
        description: formatLinearDescription(issue, repoName),
      },
    },
  );

  if (!data.issueCreate.success) {
    fail(`Linear issueCreate failed for GitHub issue #${issue.number}.`);
  }

  return data.issueCreate.issue;
}

async function createLinearComment(issueId, githubIssue, repoName) {
  const prompt = process.env.LINEAR_CODEX_PROMPT || `@Codex Process this raw capture in ${repoName}. Summarize it, classify it, and suggest whether it should become a Starlight docs page. If you make repository changes, keep them scoped to raw/inbox or docs content. Source GitHub issue: ${githubIssue.html_url}`;

  const data = await linearGraphql(
    `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment {
            id
            url
          }
        }
      }
    `,
    {
      input: {
        issueId,
        body: prompt,
      },
    },
  );

  if (!data.commentCreate.success) {
    fail(`Linear commentCreate failed for GitHub issue #${githubIssue.number}.`);
  }

  return data.commentCreate.comment;
}

function formatLinearDescription(issue, repoName) {
  return `Raw capture from GitHub issue [${repoName}#${issue.number}](${issue.html_url}).

Created: ${issue.created_at}

## Capture

${issue.body?.trim() || "_No body provided._"}
`;
}

async function linearGraphql(query, variables = {}) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: linearToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    fail(`Linear API error: ${message}`);
  }

  return payload.data;
}

async function listGitHubIssues(repoName, sourceLabel, perPage) {
  const query = new URLSearchParams({
    state: "open",
    labels: sourceLabel,
    per_page: String(perPage),
    sort: "created",
    direction: "asc",
  });

  return github(repoName, `/issues?${query.toString()}`);
}

async function listGitHubComments(repoName, issueNumber) {
  return github(repoName, `/issues/${issueNumber}/comments?per_page=100`);
}

async function ensureGitHubLabel(repoName, name, color, description) {
  try {
    await github(repoName, `/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }

    await github(repoName, "/labels", {
      method: "POST",
      body: { name, color, description },
    });
  }
}

async function createGitHubComment(repoName, issueNumber, body) {
  await github(repoName, `/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body },
  });
}

async function addGitHubLabels(repoName, issueNumber, names) {
  await github(repoName, `/issues/${issueNumber}/labels`, {
    method: "POST",
    body: { labels: names },
  });
}

async function github(repoName, route, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repoName}${route}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "documentation-raw-linear-sender",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let details = "";

    try {
      const payload = await response.json();
      details = payload.message ? `: ${payload.message}` : "";
    } catch {
      details = response.statusText ? `: ${response.statusText}` : "";
    }

    const error = new Error(`GitHub API ${response.status}${details}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function inferRepoFromGitRemote() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return null;
  }

  const remote = result.stdout.trim();
  const httpsMatch = remote.match(/github\.com[:/](?<repo>[^/]+\/[^/.]+)(?:\.git)?$/);
  return httpsMatch?.groups?.repo || null;
}

function getGitHubCliToken() {
  const result = spawnSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
