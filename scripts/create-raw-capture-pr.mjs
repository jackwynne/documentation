#!/usr/bin/env node

import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const DEFAULT_LABEL = "raw-inbox";
const CREATED_LABEL = "raw-pr-created";
const CODEX_PENDING_LABEL = "raw-codex-pending";
const NEEDS_REVIEW_LABEL = "raw-needs-review";
const PROCESSED_LABEL = "raw-processed";
const SENSITIVE_LABEL = "raw-sensitive";
const PR_LABELS = ["raw-capture", CODEX_PENDING_LABEL, "raw-automerge"];
const REQUIRED_LABELS = [
  DEFAULT_LABEL,
  CREATED_LABEL,
  CODEX_PENDING_LABEL,
  NEEDS_REVIEW_LABEL,
  PROCESSED_LABEL,
  SENSITIVE_LABEL,
  ...PR_LABELS,
];
const RAW_OUT_DIR = "raw/inbox";
const CAPTURES_DIR = "src/content/docs/captures";
const PROMPT_TEMPLATE = ".github/codex/prompts/process-raw-capture.md";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || getGitHubCliToken();
const fixture = args.fixture ? await readJson(args.fixture) : null;
const repo = args.repo || process.env.GITHUB_REPOSITORY || fixture?.repository?.full_name || inferRepoFromGitRemote();
const label = args.label || process.env.RAW_INBOX_LABEL || DEFAULT_LABEL;
const limit = Number.parseInt(args.limit || "50", 10);

if (!repo) {
  fail("Could not infer the GitHub repository. Pass --repo owner/repo or set GITHUB_REPOSITORY.");
}

if (!args.dryRun && !token) {
  fail("Missing GitHub auth. Set GITHUB_TOKEN/GH_TOKEN, or run `gh auth login`.");
}

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  fail("--limit must be an integer from 1 to 100.");
}

if (!args.dryRun) {
  requireCleanWorktree();
  configureGitIdentity();
}

if (args.ensureLabels) {
  await ensureLabels();
}

const issues = await loadIssues();
const captures = issues.filter((issue) => !issue.pull_request && hasLabel(issue, label) && !hasLabel(issue, CREATED_LABEL));

if (captures.length === 0) {
  console.log(`No open GitHub issues found for ${repo} with label "${label}" that still need PRs.`);
  process.exit(0);
}

const promptTemplate = await readFile(PROMPT_TEMPLATE, "utf8");
const existingCaptures = await indexExistingCaptures();
const baseSha = args.dryRun ? null : git(["rev-parse", "HEAD"]).stdout.trim();
const originalRef = args.dryRun ? null : git(["branch", "--show-current"], { allowFailure: true }).stdout.trim() || baseSha;

let created = 0;
let skipped = 0;

for (const issue of captures) {
  const capture = parseCapture(issue);
  const slug = slugify(capture.title || issue.title || `issue-${issue.number}`);
  const branch = `capture/issue-${issue.number}-${slug}`;
  const rawPath = path.join(RAW_OUT_DIR, issueFileName(issue, slug));
  const duplicate = capture.sourceUrl ? existingCaptures.get(normalizeUrl(capture.sourceUrl)) : null;
  const rawMarkdown = formatIssueAsMarkdown(issue, repo, capture);
  const prTitle = duplicate
    ? `Update capture from issue #${issue.number}: ${capture.title}`
    : `Process raw capture from issue #${issue.number}: ${capture.title}`;
  const prBody = formatPullRequestBody(issue, capture, rawPath, duplicate);
  const codexComment = formatCodexComment(promptTemplate, issue, capture, rawPath, duplicate);

  if (await remoteBranchHasOpenPr(branch)) {
    skipped += 1;
    console.log(`skip issue #${issue.number}; open PR already exists for ${branch}`);
    continue;
  }

  if (args.dryRun) {
    console.log(`would create branch ${branch}`);
    console.log(`would write ${rawPath}`);
    console.log(`would open PR: ${prTitle}`);
    console.log(duplicate ? `would ask Codex to update ${duplicate.folder}` : "would ask Codex to create a new capture folder");
    created += 1;
    continue;
  }

  git(["checkout", "-B", branch, baseSha]);
  await mkdir(RAW_OUT_DIR, { recursive: true });
  await writeFile(rawPath, rawMarkdown, "utf8");
  git(["add", "-f", rawPath]);

  if (git(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 0) {
    skipped += 1;
    console.log(`skip issue #${issue.number}; no file changes for ${rawPath}`);
    git(["checkout", baseSha]);
    continue;
  }

  git(["commit", "-m", `Import raw capture from issue #${issue.number}`]);
  git(["push", "--force-with-lease", "origin", branch]);

  const pr = await createPullRequest(repo, {
    title: prTitle,
    head: branch,
    base: args.base || "main",
    body: prBody,
  });

  await addLabels(repo, pr.number, PR_LABELS);
  await createIssueComment(repo, pr.number, codexComment);
  await createIssueComment(repo, issue.number, `Created raw capture PR: ${pr.html_url}`);
  await addLabels(repo, issue.number, [CREATED_LABEL]);
  await removeLabel(repo, issue.number, label);

  created += 1;
  console.log(`created PR #${pr.number} for issue #${issue.number}: ${pr.html_url}`);
}

if (!args.dryRun) {
  git(["checkout", originalRef]);
}

console.log(`Processed ${created}, skipped ${skipped}.`);

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--ensure-labels") {
      parsed.ensureLabels = true;
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
  console.log(`Create one raw capture pull request per GitHub issue labeled "${DEFAULT_LABEL}".

Usage:
  pnpm raw:create-pr [options]

Options:
  --repo owner/repo           Repository to read and mutate. Defaults to GITHUB_REPOSITORY or git remote origin.
  --issue-number number       Process one issue. Defaults to all open raw inbox issues.
  --label name                Source label. Default: ${DEFAULT_LABEL}
  --base branch               Pull request base branch. Default: main
  --limit number              Issues to fetch, 1-100. Default: 50
  --fixture path              Read a fixture issue/event JSON file instead of GitHub.
  --ensure-labels             Create workflow labels if missing.
  --dry-run                   Print intended actions without writing, pushing, or mutating GitHub.
  --help                      Show this help.
`);
}

async function loadIssues() {
  if (fixture) {
    const issue = fixture.issue || fixture;
    return Array.isArray(fixture) ? fixture : [issue];
  }

  if (args.issueNumber) {
    return [await github(repo, `/issues/${args.issueNumber}`)];
  }

  const query = new URLSearchParams({
    state: "open",
    labels: label,
    per_page: String(limit),
    sort: "created",
    direction: "asc",
  });

  return github(repo, `/issues?${query.toString()}`);
}

async function ensureLabels() {
  const colors = new Map([
    [DEFAULT_LABEL, "0E8A16"],
    [CREATED_LABEL, "1D76DB"],
    [CODEX_PENDING_LABEL, "5319E7"],
    [NEEDS_REVIEW_LABEL, "D93F0B"],
    [PROCESSED_LABEL, "0E8A16"],
    [SENSITIVE_LABEL, "B60205"],
    ["raw-capture", "0052CC"],
    ["raw-automerge", "0E8A16"],
  ]);

  for (const name of REQUIRED_LABELS) {
    await ensureLabel(repo, name, colors.get(name) || "5319E7", `Raw capture workflow label: ${name}.`);
  }
}

function parseCapture(issue) {
  const body = issue.body || "";
  const titleLine = body.match(/^Title:\s*(?<title>.+)$/im)?.groups?.title?.trim();
  const sourceUrl = extractSourceUrl(body);
  const sharedContent = body.match(/^Shared content:\s*\n(?<content>[\s\S]+)$/im)?.groups?.content?.trim() || "";
  const sourceType = sourceUrl ? inferSourceType(sourceUrl) : "text";

  return {
    title: cleanupTitle(titleLine || issue.title || `GitHub issue ${issue.number}`),
    sourceUrl,
    sharedContent,
    sourceType,
    capturedAt: issue.created_at || new Date().toISOString(),
  };
}

function extractSourceUrl(body) {
  const urlLine = body.match(/^URL:\s*(?<url>.+)$/im)?.groups?.url?.trim();
  const candidate = urlLine && urlLine !== "()" ? urlLine : body.match(/https?:\/\/[^\s)]+/i)?.[0];

  if (!candidate) {
    return "";
  }

  return candidate
    .split(/\s+/)
    .find((value) => /^https?:\/\//i.test(value))
    ?.replace(/[),.]+$/, "") || "";
}

function inferSourceType(sourceUrl) {
  try {
    const host = new URL(sourceUrl).hostname;

    if (host.includes("github.com")) return "github";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "video";
    if (host.includes("x.com") || host.includes("twitter.com") || host.includes("bsky.app")) return "social";
    return "article";
  } catch {
    return "url";
  }
}

function cleanupTitle(title) {
  return title.replace(/^Raw:\s*/i, "").trim() || "Raw capture";
}

function issueFileName(issue, slug) {
  const date = (issue.created_at || new Date().toISOString()).slice(0, 10);
  return `${date}-github-${issue.number}-${slug}.md`;
}

function formatIssueAsMarkdown(issue, repoName, capture) {
  const labels = issue.labels.map((item) => item.name || item);

  return `---
title: ${yamlString(capture.title)}
source: github-issue
repository: ${repoName}
issue_number: ${issue.number}
issue_url: ${issue.html_url}
source_url: ${yamlString(capture.sourceUrl)}
source_type: ${yamlString(capture.sourceType)}
captured_at: ${yamlString(capture.capturedAt)}
labels: ${JSON.stringify(labels)}
---

# ${capture.title}

Source issue: [${repoName}#${issue.number}](${issue.html_url})
${capture.sourceUrl ? `Source URL: ${capture.sourceUrl}` : "Source URL: _No public URL provided._"}

Captured: ${capture.capturedAt}

## Raw Capture

${issue.body?.trim() || "_No body provided._"}

## Processing Notes

- Publishing recommendation: Generate a public summary only if the source is safe to publish.
- Suggested destination: \`src/content/docs/captures/\`.
`;
}

function formatPullRequestBody(issue, capture, rawPath, duplicate) {
  return `Creates a raw capture handoff for GitHub issue #${issue.number}.

- Raw file: \`${rawPath}\`
- Source URL: ${capture.sourceUrl || "_none provided_"}
- Source type: \`${capture.sourceType}\`
- Codex target: ${duplicate ? `update existing capture folder \`${duplicate.folder}\`` : "create a new capture folder under `src/content/docs/captures/`"}

Codex should summarize the source in original words, classify it with \`docs/capture-taxonomy.md\`, and avoid publishing sensitive, private, credential-like, or paywalled material.
`;
}

function formatCodexComment(promptTemplate, issue, capture, rawPath, duplicate) {
  const duplicateInstruction = duplicate
    ? `Update the existing capture folder \`${duplicate.folder}\`; do not create a duplicate page for the same source URL.`
    : "Create a new capture folder for this source if it is safe to publish.";

  return `${promptTemplate.trim()}

## This Capture

- Raw file: \`${rawPath}\`
- GitHub issue: ${issue.html_url}
- Source URL: ${capture.sourceUrl || "_none provided_"}
- Source type: \`${capture.sourceType}\`
- Duplicate handling: ${duplicateInstruction}
`;
}

async function indexExistingCaptures() {
  const index = new Map();

  if (!(await fileExists(CAPTURES_DIR))) {
    return index;
  }

  for await (const filePath of walk(CAPTURES_DIR)) {
    if (!/\.mdx?$/.test(filePath)) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    const sourceUrl = frontmatter.source_url;

    if (sourceUrl) {
      index.set(normalizeUrl(sourceUrl), {
        file: filePath,
        folder: path.dirname(filePath),
      });
    }
  }

  return index;
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(filePath);
    } else if (entry.isFile()) {
      yield filePath;
    }
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n(?<body>[\s\S]*?)\n---/);
  const values = {};

  if (!match) {
    return values;
  }

  for (const line of match.groups.body.split("\n")) {
    const field = line.match(/^(?<key>[A-Za-z0-9_-]+):\s*(?<value>.*)$/);

    if (field) {
      values[field.groups.key] = field.groups.value.replace(/^["']|["']$/g, "").trim();
    }
  }

  return values;
}

async function remoteBranchHasOpenPr(branch) {
  if (args.dryRun) {
    return false;
  }

  const owner = repo.split("/")[0];
  const query = new URLSearchParams({
    state: "open",
    head: `${owner}:${branch}`,
    per_page: "1",
  });
  const pulls = await github(repo, `/pulls?${query.toString()}`);

  return pulls.length > 0;
}

async function createPullRequest(repoName, body) {
  return github(repoName, "/pulls", {
    method: "POST",
    body,
  });
}

async function ensureLabel(repoName, name, color, description) {
  if (args.dryRun) {
    console.log(`would ensure label: ${name}`);
    return;
  }

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
    console.log(`created label: ${name}`);
  }
}

async function addLabels(repoName, issueNumber, names) {
  await github(repoName, `/issues/${issueNumber}/labels`, {
    method: "POST",
    body: { labels: names },
  });
}

async function removeLabel(repoName, issueNumber, name) {
  try {
    await github(repoName, `/issues/${issueNumber}/labels/${encodeURIComponent(name)}`, {
      method: "DELETE",
      expectNoContent: true,
    });
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }
}

async function createIssueComment(repoName, issueNumber, body) {
  await github(repoName, `/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body },
  });
}

async function github(repoName, route, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repoName}${route}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "documentation-raw-capture-pr",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (options.expectNoContent && response.status === 204) {
    return null;
  }

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

function configureGitIdentity() {
  const name = git(["config", "--get", "user.name"], { allowFailure: true }).stdout.trim();
  const email = git(["config", "--get", "user.email"], { allowFailure: true }).stdout.trim();

  if (!name) {
    git(["config", "user.name", "github-actions[bot]"]);
  }

  if (!email) {
    git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  }
}

function requireCleanWorktree() {
  const result = git(["status", "--porcelain"], { allowFailure: false });

  if (result.stdout.trim()) {
    fail("Working tree is not clean. Commit or stash local changes before creating raw capture PRs.");
  }
}

function git(argsList, options = {}) {
  const result = spawnSync("git", argsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 && !options.allowFailure) {
    fail(`git ${argsList.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result;
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

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "capture";
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function hasLabel(issue, name) {
  return issue.labels?.some((label) => (label.name || label).toLowerCase() === name.toLowerCase());
}

function yamlString(value) {
  return JSON.stringify(value || "");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
