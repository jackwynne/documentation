#!/usr/bin/env node

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const DEFAULT_LABEL = "raw-inbox";
const DEFAULT_IMPORTED_LABEL = "raw-imported";
const DEFAULT_OUT_DIR = "raw/inbox";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  fail("Missing GITHUB_TOKEN or GH_TOKEN. Use a fine-grained GitHub token with issue read/write access for this repository.");
}

const repo = args.repo || process.env.GITHUB_REPOSITORY || inferRepoFromGitRemote();

if (!repo) {
  fail("Could not infer the GitHub repository. Pass --repo owner/repo or set GITHUB_REPOSITORY.");
}

const label = args.label || process.env.RAW_INBOX_LABEL || DEFAULT_LABEL;
const importedLabel = args.importedLabel || process.env.RAW_IMPORTED_LABEL || DEFAULT_IMPORTED_LABEL;
const outDir = args.out || process.env.RAW_INBOX_DIR || DEFAULT_OUT_DIR;
const limit = Number.parseInt(args.limit || "50", 10);

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  fail("--limit must be an integer from 1 to 100.");
}

if (args.ensureLabels) {
  await ensureLabel(repo, label, "0E8A16", "Raw capture inbox for notes and articles.");
  await ensureLabel(repo, importedLabel, "5319E7", "Raw capture issue imported into the repository workspace.");
}

const issues = await listIssues(repo, label, limit);
const captures = issues.filter((issue) => !issue.pull_request);

if (captures.length === 0) {
  console.log(`No open GitHub issues found for ${repo} with label "${label}".`);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

let created = 0;
let skipped = 0;
let mutated = 0;

for (const issue of captures) {
  const filePath = path.join(outDir, issueFileName(issue));
  const exists = await fileExists(filePath);

  if (exists) {
    skipped += 1;
    console.log(`skip existing ${filePath}`);
  } else {
    const markdown = formatIssueAsMarkdown(issue, repo);

    if (args.dryRun) {
      console.log(`would write ${filePath}`);
    } else {
      await writeFile(filePath, markdown, "utf8");
      console.log(`wrote ${filePath}`);
    }

    created += 1;
  }

  if (!args.dryRun && !exists && args.markImported) {
    await addLabels(repo, issue.number, [importedLabel]);
    await removeLabel(repo, issue.number, label);
    mutated += 1;
  }

  if (!args.dryRun && !exists && args.close) {
    await updateIssue(repo, issue.number, { state: "closed" });
    mutated += 1;
  }
}

console.log(`Imported ${created}, skipped ${skipped}, updated ${mutated} issue action(s).`);

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--close") {
      parsed.close = true;
    } else if (arg === "--mark-imported") {
      parsed.markImported = true;
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
  console.log(`Import GitHub issues labeled "${DEFAULT_LABEL}" into raw/inbox.

Usage:
  GITHUB_TOKEN=... pnpm raw:import-github [options]

Options:
  --repo owner/repo           Repository to import from. Defaults to GITHUB_REPOSITORY or git remote origin.
  --label name                Source label. Default: ${DEFAULT_LABEL}
  --imported-label name       Imported label. Default: ${DEFAULT_IMPORTED_LABEL}
  --out directory             Output directory. Default: ${DEFAULT_OUT_DIR}
  --limit number              Issues to fetch, 1-100. Default: 50
  --ensure-labels             Create the source/imported labels if missing.
  --mark-imported             Add imported label and remove source label after writing a note.
  --close                     Close each issue after writing a note.
  --dry-run                   Print intended actions without writing or mutating GitHub.
  --help                      Show this help.
`);
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

function issueFileName(issue) {
  const date = issue.created_at.slice(0, 10);
  const slug = slugify(issue.title || `issue-${issue.number}`);
  return `${date}-github-${issue.number}-${slug}.md`;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "capture";
}

function formatIssueAsMarkdown(issue, repoName) {
  const capturedAt = new Date().toISOString();
  const title = yamlString(issue.title || `GitHub issue ${issue.number}`);
  const labels = issue.labels.map((item) => item.name);

  return `---
title: ${title}
source: github-issue
repository: ${repoName}
issue_number: ${issue.number}
issue_url: ${issue.html_url}
captured_at: ${capturedAt}
labels: ${JSON.stringify(labels)}
---

# ${issue.title}

Source: [GitHub issue #${issue.number}](${issue.html_url})

Captured: ${capturedAt}

## Raw Capture

${issue.body?.trim() || "_No body provided._"}

## Processing Notes

- Publishing recommendation: Review before publishing.
- Suggested destination: Keep in raw until a target docs section is clear.
`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listIssues(repoName, sourceLabel, perPage) {
  const query = new URLSearchParams({
    state: "open",
    labels: sourceLabel,
    per_page: String(perPage),
    sort: "created",
    direction: "asc",
  });

  return github(repoName, `/issues?${query.toString()}`);
}

async function ensureLabel(repoName, name, color, description) {
  try {
    await github(repoName, `/labels/${encodeURIComponent(name)}`);
    console.log(`label exists: ${name}`);
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

async function updateIssue(repoName, issueNumber, body) {
  await github(repoName, `/issues/${issueNumber}`, {
    method: "PATCH",
    body,
  });
}

async function github(repoName, route, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repoName}${route}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "documentation-raw-inbox-importer",
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

function fail(message) {
  console.error(message);
  process.exit(1);
}
