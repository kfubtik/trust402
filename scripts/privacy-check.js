import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const root = process.cwd();
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

for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel === ".env.example") continue;

  if (forbiddenPathPatterns.some((pattern) => pattern.test(rel))) {
    problems.push(`local-only path should not be present: ${rel}`);
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
