#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { finalVerificationReport } from "../src/finalVerification.js";

const args = process.argv.slice(2);
const baseUrl = (args.find((arg) => /^https?:\/\//.test(arg)) || config.publicBaseUrl).replace(/\/+$/, "");
const timeoutMs = numberArg("--timeout-ms", 10_000);
const strict = args.includes("--strict");
const includeDetails = args.includes("--include-details");
const skipDocker = args.includes("--skip-docker");
const skipDirectories = args.includes("--skip-directories");
const withVercelLogs = args.includes("--with-vercel-logs");
const externalDirectoryEvidenceUrl = valueArg("--external-directory-evidence-url");
const externalDirectoryName = valueArg("--external-directory-name");
const externalDirectoryEvidenceSource = valueArg("--external-directory-evidence-source") || "operator-provided";
const dockerBin = valueArg("--docker-bin") || process.env.TRUST402_DOCKER_BIN || defaultDockerBin();
const nodeBin = process.execPath;
const npxBin = "npx";

async function main() {
  const releaseCheck = runCommand("release_check", "Local release gate", nodeBin, ["scripts/release-check.js"]);
  const dockerCheck = skipDocker
    ? skipped("docker_build", "Docker build", "Skipped by --skip-docker.")
    : runCommand("docker_build", "Docker build", dockerBin, ["build", "-t", "trust402:test", "."]);
  const deploymentSyncCheck = await productionDeploymentSyncCheck(baseUrl, timeoutMs);
  const productionSmokeCheck = deploymentSyncCheck.status === "passed"
    ? runCommand("production_smoke", "Production smoke", nodeBin, ["scripts/smoke.js", baseUrl])
    : skipped(
        "production_smoke",
        "Production smoke",
        "Skipped because production deployment is behind the local smoke contract.",
        true,
        "Deploy the current GitHub HEAD to production, then rerun production smoke."
      );
  const checks = [
    releaseCheck,
    dockerCheck,
    deploymentSyncCheck,
    productionSmokeCheck,
    runCommand("production_x402_smoke", "Production x402 smoke", nodeBin, ["scripts/x402-smoke.js", baseUrl]),
    runCommand("agentcash_refill_check", "AgentCash refill dry-run check", nodeBin, ["scripts/agentcash-refill-check.js"]),
    runCommand("launch_monitor", "Production launch monitor", nodeBin, [
      "scripts/launch-monitor.js",
      baseUrl,
      `--timeout-ms=${timeoutMs}`,
      "--skip-directories",
      "--strict"
    ]),
    skipDirectories
      ? skipped("external_directories", "External directories", "Skipped by --skip-directories.", false)
      : runCommand("external_directories", "External directory visibility", nodeBin, [
          "scripts/check-external-directories.js",
          baseUrl,
          `--timeout-ms=${timeoutMs}`
        ], { required: false }),
    externalDirectoryEvidenceUrl
      ? externalDirectoryEvidenceCheck({
          baseUrl,
          directoryName: externalDirectoryName,
          evidenceUrl: externalDirectoryEvidenceUrl,
          evidenceSource: externalDirectoryEvidenceSource
        })
      : skipped("external_directory_evidence", "External directory evidence", "No explicit external directory evidence URL supplied.", false),
    runCommand("production_completion_audit", "Production completion audit", nodeBin, [
      "scripts/completion-audit.js",
      baseUrl
    ]),
    withVercelLogs
      ? runCommand("vercel_error_logs", "Vercel production error logs", npxBin, [
          "vercel@latest",
          "logs",
          baseUrl,
          "--since",
          "30m",
          "--level",
          "error"
        ], { required: false, passWhenOutputIncludes: "No logs found" })
      : skipped("vercel_error_logs", "Vercel production error logs", "Skipped unless --with-vercel-logs is set.", false)
  ];

  const auditCheck = checks.find((check) => check.id === "production_completion_audit");
  const productionAudit = parseJsonOutput(auditCheck?.stdout);
  const report = finalVerificationReport({
    baseUrl,
    checks,
    productionAudit,
    includeDetails
  });

  console.log(JSON.stringify(report, null, 2));
  if (strict && report.status !== "complete" && report.status !== "ready-for-final-evidence") process.exit(1);
}

function runCommand(id, label, command, commandArgs, options = {}) {
  const started = Date.now();
  const commandEnv = envWithCommandDirectory(command);
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: shouldUseShell(command),
    env: commandEnv,
    maxBuffer: 30 * 1024 * 1024
  });
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || result.error?.message || "");
  const required = options.required !== false;
  const combinedOutput = `${stdout}\n${stderr}`;
  const passed = result.status === 0 &&
    (!options.passWhenOutputIncludes || combinedOutput.includes(options.passWhenOutputIncludes));
  return {
    id,
    label,
    status: passed ? "passed" : "failed",
    required,
    skipped: false,
    exitCode: result.status,
    durationMs: Date.now() - started,
    stdout,
    stderr,
    nextAction: passed ? null : nextActionFor(id)
  };
}

async function productionDeploymentSyncCheck(targetBaseUrl, timeoutMs) {
  const started = Date.now();
  const root = targetBaseUrl.replace(/\/+$/, "");
  const url = `${root}/api/deployments/preflight`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    let body = null;
    try {
      body = text.trim() ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    const health = await fetchJsonOrNull(`${root}/health`, timeoutMs);
    const localGitHead = commandText("git", ["rev-parse", "--short", "HEAD"]);
    const healthGitCommitSha = health?.deployment?.gitCommitSha || "";
    const gitCommitMatchesHead = healthGitCommitSha && localGitHead
      ? sameCommit(healthGitCommitSha, localGitHead)
      : null;
    const hasCurrentContract = Boolean(
      body?.requirementStatus?.gitVercelAutoDeploy &&
      body?.requirementStatus?.customDomain
    );
    const passed = response.ok && hasCurrentContract && gitCommitMatchesHead !== false;
    return {
      id: "production_deployment_sync",
      label: "Production deployment schema sync",
      status: passed ? "passed" : "failed",
      required: true,
      skipped: false,
      exitCode: passed ? 0 : 1,
      durationMs: Date.now() - started,
      stdout: JSON.stringify({
        ok: response.ok,
        status: response.status,
        hasDeploymentPreflight: body?.tool === "deployment.preflight",
        hasRequirementStatus: Boolean(body?.requirementStatus),
        hasGitVercelRequirementStatus: Boolean(body?.requirementStatus?.gitVercelAutoDeploy),
        hasCustomDomainRequirementStatus: Boolean(body?.requirementStatus?.customDomain),
        hasHealthDeploymentMetadata: Boolean(health?.deployment),
        healthGitCommitSha: healthGitCommitSha || null,
        localGitHead: localGitHead || null,
        gitCommitMatchesHead
      }),
      stderr: "",
      nextAction: passed
        ? null
        : gitCommitMatchesHead === false
          ? "Production health metadata reports a different Git commit; deploy the current GitHub HEAD before final verification."
          : "Production is behind the local verification contract; deploy the current GitHub HEAD before running final production smoke."
    };
  } catch (error) {
    return {
      id: "production_deployment_sync",
      label: "Production deployment schema sync",
      status: "failed",
      required: true,
      skipped: false,
      exitCode: 1,
      durationMs: Date.now() - started,
      stdout: "",
      stderr: String(error?.message || error),
      nextAction: "Production deployment sync check failed; verify the production URL and deploy current HEAD before final verification."
    };
  }
}

async function fetchJsonOrNull(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    if (!response.ok || !text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function commandText(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: shouldUseShell(command)
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function sameCommit(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && (a === b || a.startsWith(b) || b.startsWith(a)));
}

function shouldUseShell(command) {
  if (process.platform !== "win32") return false;
  const value = String(command || "");
  if (path.isAbsolute(value) || value.toLowerCase().endsWith(".exe")) return false;
  return true;
}

function envWithCommandDirectory(command) {
  if (!command || command === "npm" || command === "npx" || command === "docker") return process.env;
  const directory = path.dirname(command);
  if (!directory || directory === ".") return process.env;
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const currentPath = process.env[pathKey] || process.env.PATH || "";
  return {
    ...process.env,
    [pathKey]: `${directory}${path.delimiter}${currentPath}`
  };
}

function defaultDockerBin() {
  if (process.platform !== "win32") return "docker";
  const knownDockerDesktopPath = "D:\\Programs\\Docker\\resources\\bin\\docker.exe";
  return existsSync(knownDockerDesktopPath) ? knownDockerDesktopPath : "docker";
}

function skipped(id, label, reason, required = true, nextAction = null) {
  return {
    id,
    label,
    status: required ? "skipped-required" : "skipped",
    required,
    skipped: true,
    reason,
    nextAction: required ? (nextAction || "Run this check before recording final verification evidence.") : null
  };
}

function externalDirectoryEvidenceCheck({ baseUrl, directoryName, evidenceUrl, evidenceSource }) {
  const started = Date.now();
  const parsedEvidenceUrl = safeUrl(evidenceUrl);
  const parsedBaseUrl = safeUrl(baseUrl);
  const validEvidenceUrl = Boolean(parsedEvidenceUrl);
  const sameAsService = parsedEvidenceUrl && parsedBaseUrl
    ? parsedEvidenceUrl.origin === parsedBaseUrl.origin
    : false;
  const name = String(directoryName || "").trim();
  const passed = validEvidenceUrl && !sameAsService && Boolean(name);
  const stdout = JSON.stringify({
    ok: passed,
    tool: "external_directory.evidence",
    status: passed ? "visible-in-some-directories" : "invalid-evidence",
    source: evidenceSource,
    evidence: {
      directoryName: name || null,
      evidenceUrl,
      baseUrl,
      publicSafe: true,
      includesSecrets: false,
      sendsPaymentHeaders: false,
      mutatesWallet: false
    },
    summary: {
      checked: passed ? 1 : 0,
      reachable: passed ? 1 : 0,
      visible: passed ? 1 : 0,
      notVisibleYet: 0,
      unreachable: passed ? 0 : 1,
      customDomainBlocked: 0
    },
    directories: passed
      ? [
          {
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "external_directory",
            name,
            reachable: true,
            visible: true,
            matchedUrls: [evidenceUrl],
            evidenceSource
          }
        ]
      : []
  });

  return {
    id: "external_directory_evidence",
    label: "External directory evidence",
    status: passed ? "passed" : "failed",
    required: false,
    skipped: false,
    exitCode: passed ? 0 : 1,
    durationMs: Date.now() - started,
    stdout,
    stderr: "",
    nextAction: passed
      ? null
      : "Pass both --external-directory-name and a public --external-directory-evidence-url that is not the Trust402 service itself."
  };
}

function safeUrl(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    return null;
  }
}

function parseJsonOutput(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function nextActionFor(id) {
  if (id === "docker_build") return "Install/start Docker or rerun with --docker-bin pointing at docker.exe.";
  if (id === "external_directories") return "External directory visibility is advisory; submit public-safe listing copy where allowed.";
  if (id === "vercel_error_logs") return "Inspect Vercel auth/project access or rerun without --with-vercel-logs.";
  return "Inspect command output and fix the failing gate.";
}

function numberArg(name, fallback) {
  const value = valueArg(name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function valueArg(name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
