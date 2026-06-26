#!/usr/bin/env node

import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const RAW_FILE_PATTERN = /^raw\/inbox\/[^/]+\.md$/;
const CAPTURE_FILE_PATTERN = /^src\/content\/docs\/captures\/([^/]+)\/(.+)$/;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const REQUIRED_FRONTMATTER = [
  "title",
  "description",
  "source_url",
  "source_type",
  "captured_at",
  "topics",
  "tags",
  "raw_issue",
  "publish_status",
];
const ACTIVE_CONTENT_PATTERNS = [
  /<script\b/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /onerror\s*=/i,
  /onclick\s*=/i,
  /dangerouslySetInnerHTML/i,
];
const SECRET_PATTERNS = [
  /BEGIN PRIVATE KEY/i,
  /\bapi_key\b/i,
  /\baccess_token\b/i,
  /\bpassword\s*:/i,
  /Authorization:\s*Bearer/i,
];
const SENSITIVE_PATTERNS = [
  /\bconfidential\b/i,
  /\binternal use only\b/i,
  /\bdo not distribute\b/i,
  /\bpaywalled?\b/i,
  /\bsubscriber[- ]only\b/i,
  /\bcredential\b/i,
];
const MAX_PAGE_LENGTH = 16000;
const MIN_COPY_BLOCK_LENGTH = 700;

const args = parseArgs(process.argv.slice(2));
const reportFile = args.reportFile || process.env.RAW_CAPTURE_VALIDATION_REPORT;

if (args.help) {
  printHelp();
  process.exit(0);
}

const failures = [];
const changedFileEntries = await loadChangedFiles();
const changedFiles = changedFileEntries.map((entry) => entry.filename);
const rawFiles = [];
const captureFolders = new Map();

if (changedFiles.length === 0) {
  addFailure("No changed files were found.");
}

for (const entry of changedFileEntries) {
  const filePath = entry.filename;

  if (entry.status === "removed") {
    addFailure(`Deleted files are not allowed in raw capture PRs: ${filePath}`);
    continue;
  }

  if (RAW_FILE_PATTERN.test(filePath)) {
    rawFiles.push(filePath);
    continue;
  }

  const captureMatch = filePath.match(CAPTURE_FILE_PATTERN);

  if (captureMatch) {
    const [, slug, relativePath] = captureMatch;
    const folder = `src/content/docs/captures/${slug}`;

    if (!captureFolders.has(folder)) {
      captureFolders.set(folder, []);
    }

    captureFolders.get(folder).push(relativePath);
    validateCaptureRelativePath(filePath, relativePath);
    continue;
  }

  addFailure(`Changed file is outside approved raw capture paths: ${filePath}`);
}

if (rawFiles.length === 0) {
  addFailure("At least one raw inbox Markdown file must be included.");
}

if (captureFolders.size === 0) {
  addFailure("At least one generated capture folder must be included under src/content/docs/captures/.");
}

const rawContents = [];

for (const rawFile of rawFiles) {
  if (!(await fileExists(rawFile))) {
    addFailure(`Raw file does not exist: ${rawFile}`);
    continue;
  }

  rawContents.push(await readFile(rawFile, "utf8"));
}

for (const [folder] of captureFolders) {
  await validateCaptureFolder(folder, rawContents);
}

await finish();

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
  console.log(`Validate a raw capture pull request.

Usage:
  pnpm raw:validate-pr [options]

Options:
  --base ref                 Compare ref for local validation. Default: origin/main
  --files comma,list         Validate a specific comma-separated file list.
  --report-file path         Write a Markdown validation report.
  --help                     Show this help.

In GitHub Actions, set GITHUB_REPOSITORY, PR_NUMBER, and GITHUB_TOKEN to load changed files from the pull request API.
`);
}

async function loadChangedFiles() {
  if (args.files) {
    return args.files
      .split(",")
      .map((filename) => filename.trim())
      .filter(Boolean)
      .map((filename) => ({ filename, status: "modified" }));
  }

  if (process.env.GITHUB_REPOSITORY && process.env.PR_NUMBER && (process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) {
    return listPullRequestFiles(process.env.GITHUB_REPOSITORY, process.env.PR_NUMBER);
  }

  const base = args.base || process.env.RAW_CAPTURE_BASE || "origin/main";
  const result = spawnSync("git", ["diff", "--name-status", `${base}...HEAD`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(`git diff failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [statusCode, filename] = line.split(/\t+/);
      return {
        filename,
        status: statusCode === "D" ? "removed" : "modified",
      };
    });
}

async function listPullRequestFiles(repo, prNumber) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const files = [];

  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({
      per_page: "100",
      page: String(page),
    });
    const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?${query.toString()}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "documentation-raw-capture-validator",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      fail(`GitHub API ${response.status} while listing PR files.`);
    }

    const payload = await response.json();
    files.push(...payload.map((file) => ({ filename: file.filename, status: file.status })));

    if (payload.length < 100) {
      break;
    }
  }

  return files;
}

function validateCaptureRelativePath(filePath, relativePath) {
  if (relativePath === "index.md" || relativePath === "index.mdx") {
    return;
  }

  const extension = path.extname(relativePath).toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension)) {
    return;
  }

  addFailure(`Unsupported file inside capture folder: ${filePath}`);
}

async function validateCaptureFolder(folder, rawContents) {
  if (!(await fileExists(folder))) {
    addFailure(`Capture folder does not exist: ${folder}`);
    return;
  }

  const entries = await readdir(folder, { withFileTypes: true });
  const primaryPages = entries
    .filter((entry) => entry.isFile() && (entry.name === "index.md" || entry.name === "index.mdx"))
    .map((entry) => path.join(folder, entry.name));

  if (primaryPages.length !== 1) {
    addFailure(`Capture folder must contain exactly one primary page, index.md or index.mdx: ${folder}`);
    return;
  }

  const pagePath = primaryPages[0];
  const pageContent = await readFile(pagePath, "utf8");
  const frontmatter = parseFrontmatter(pageContent);

  if (!frontmatter) {
    addFailure(`Capture page is missing frontmatter: ${pagePath}`);
    return;
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (!frontmatter.has(key)) {
      addFailure(`Capture page is missing required frontmatter "${key}": ${pagePath}`);
    }
  }

  const publishStatus = getFrontmatterValue(frontmatter, "publish_status");

  if (publishStatus !== "published-summary") {
    addFailure(`publish_status must be "published-summary": ${pagePath}`);
  }

  if (pageContent.length > MAX_PAGE_LENGTH) {
    addFailure(`Capture page is too long for an auto-merged summary: ${pagePath}`);
  }

  for (const pattern of ACTIVE_CONTENT_PATTERNS) {
    if (pattern.test(pageContent)) {
      addFailure(`Capture page contains blocked active content pattern ${pattern}: ${pagePath}`);
    }
  }

  validateSecretAndSensitiveContent(pagePath, pageContent);
  validateCopiedRawContent(pagePath, pageContent, rawContents);

  for await (const filePath of walk(folder)) {
    if (filePath === pagePath) {
      continue;
    }

    const extension = path.extname(filePath).toLowerCase();

    if (!IMAGE_EXTENSIONS.has(extension)) {
      addFailure(`Only local images are allowed beside the capture page: ${filePath}`);
      continue;
    }

    validateSecretAndSensitiveContent(filePath, await readFile(filePath, "utf8").catch(() => ""));
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n(?<body>[\s\S]*?)\n---/);

  if (!match) {
    return null;
  }

  const values = new Map();

  for (const line of match.groups.body.split("\n")) {
    const field = line.match(/^(?<key>[A-Za-z0-9_-]+):\s*(?<value>.*)$/);

    if (field) {
      values.set(field.groups.key, field.groups.value.trim());
    }
  }

  return values;
}

function getFrontmatterValue(frontmatter, key) {
  return (frontmatter.get(key) || "").replace(/^["']|["']$/g, "").trim();
}

function validateSecretAndSensitiveContent(filePath, content) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      addFailure(`Changed content contains an obvious secret-like pattern ${pattern}: ${filePath}`);
    }
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      addFailure(`Changed content contains sensitive or paywall-like wording ${pattern}: ${filePath}`);
    }
  }
}

function validateCopiedRawContent(pagePath, pageContent, rawContents) {
  const normalizedPage = normalizeText(stripFrontmatter(pageContent));

  for (const rawContent of rawContents) {
    validateSecretAndSensitiveContent("raw inbox content", rawContent);

    const rawCapture = extractRawCapture(rawContent);
    const normalizedRaw = normalizeText(rawCapture);

    if (normalizedRaw.length >= MIN_COPY_BLOCK_LENGTH && normalizedPage.includes(normalizedRaw.slice(0, MIN_COPY_BLOCK_LENGTH))) {
      addFailure(`Capture page appears to include a large exact copy of the raw issue body: ${pagePath}`);
    }

    for (const paragraph of rawCapture.split(/\n{2,}/)) {
      const normalizedParagraph = normalizeText(paragraph);

      if (normalizedParagraph.length >= MIN_COPY_BLOCK_LENGTH && normalizedPage.includes(normalizedParagraph)) {
        addFailure(`Capture page includes a long exact paragraph from the raw issue body: ${pagePath}`);
      }
    }
  }
}

function extractRawCapture(rawContent) {
  const marker = rawContent.match(/## Raw Capture\s+(?<body>[\s\S]*?)(?:\n## |\n# |$)/i);
  return marker?.groups?.body || rawContent;
}

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---/, "");
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
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

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function addFailure(message) {
  failures.push(message);
}

async function finish() {
  if (failures.length > 0) {
    const report = `# Raw Capture Validation Failed

${failures.map((failure) => `- ${failure}`).join("\n")}
`;

    if (reportFile) {
      await writeFile(reportFile, report, "utf8");
    }

    console.error(report);
    process.exit(1);
  }

  const report = "# Raw Capture Validation Passed\n\nAll raw capture gates passed.\n";

  if (reportFile) {
    await writeFile(reportFile, report, "utf8");
  }

  console.log(report);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
