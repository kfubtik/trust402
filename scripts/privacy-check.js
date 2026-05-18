import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const root = process.cwd();
const gitEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "safe.directory",
  GIT_CONFIG_VALUE_0: root.replaceAll("\\", "/")
};
const ignoredDirs = new Set([".git", "node_modules"]);
const forbiddenPathPatterns = [
  /^\.env$/,
  /^\.env\./,
  /^data([/\\]|$)/,
  /^\.agentcash([/\\]|$)/,
  /wallet.*\.json$/i,
  /\.log$/i,
  /seed/i,
  /private.?key/i
];
const suspiciousContentPatterns = [
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /\b(seed phrase|mnemonic|private key)\b\s*[:=]/i,
  /\bX-Payment\b\s*[:=]\s*[-A-Za-z0-9_.+/=]{20,}/i,
  /\b[A-Za-z0-9_]*API_KEY\b\s*[:=]\s*['"]?[-A-Za-z0-9_]{20,}/i
];

const problems = [];

for (const rel of candidateFiles()) {
  if (rel === ".env.example") continue;
  const file = join(root, rel);
  if (!existsSync(file) || !statSync(file).isFile()) continue;

  const tracked = isGitTracked(rel);
  const ignored = isGitIgnored(rel);
  if (!tracked && ignored) continue;

  if (forbiddenPathPatterns.some((pattern) => pattern.test(rel))) {
    if (tracked) {
      problems.push(`local-only path is tracked: ${rel}`);
    } else if (!ignored) {
      problems.push(`local-only path is not ignored: ${rel}`);
    }
    continue;
  }

  if (isTextFile(file)) {
    const content = readFileSync(file, "utf8");
    for (const pattern of suspiciousContentPatterns) {
      if (pattern.test(content)) {
        problems.push(`suspicious secret-like content in ${rel}: ${pattern}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Trust402 privacy check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Trust402 privacy check passed.");

function candidateFiles() {
  const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    env: gitEnv,
    shell: false
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replaceAll("\\", "/"))
      .filter(Boolean);
  }

  return Array.from(walk(root), (file) => relative(root, file).replaceAll("\\", "/"));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      yield* walk(fullPath);
    } else if (stats.isFile()) {
      yield fullPath;
    }
  }
}

function isTextFile(file) {
  const name = basename(file).toLowerCase();
  return /\.(js|json|md|txt|yml|yaml|example|gitignore)$/i.test(name) || !name.includes(".");
}

function isGitTracked(rel) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", rel], {
    cwd: root,
    encoding: "utf8",
    env: gitEnv,
    shell: false
  });
  return result.status === 0;
}

function isGitIgnored(rel) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", rel], {
    cwd: root,
    encoding: "utf8",
    env: gitEnv,
    shell: false
  });
  return result.status === 0;
}
