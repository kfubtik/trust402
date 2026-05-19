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
const dockerBin = valueArg("--docker-bin") || process.env.TRUST402_DOCKER_BIN || defaultDockerBin();
const npmBin = "npm";
const npxBin = "npx";

async function main() {
  const checks = [
    runCommand("release_check", "Local release gate", npmBin, ["run", "release:check"]),
    skipDocker
      ? skipped("docker_build", "Docker build", "Skipped by --skip-docker.")
      : runCommand("docker_build", "Docker build", dockerBin, ["build", "-t", "trust402:test", "."]),
    runCommand("production_smoke", "Production smoke", npmBin, ["run", "smoke", "--", baseUrl]),
    runCommand("production_x402_smoke", "Production x402 smoke", npmBin, ["run", "smoke:x402", "--", baseUrl]),
    runCommand("agentcash_refill_check", "AgentCash refill dry-run check", npmBin, ["run", "agentcash:refill-check"]),
    runCommand("launch_monitor", "Production launch monitor", npmBin, [
      "run",
      "launch:monitor",
      "--",
      baseUrl,
      `--timeout-ms=${timeoutMs}`,
      "--skip-directories",
      "--strict"
    ]),
    skipDirectories
      ? skipped("external_directories", "External directories", "Skipped by --skip-directories.", false)
      : runCommand("external_directories", "External directory visibility", npmBin, [
          "run",
          "directories:check",
          "--",
          baseUrl,
          `--timeout-ms=${timeoutMs}`
        ], { required: false }),
    runCommand("production_completion_audit", "Production completion audit", npmBin, [
      "run",
      "completion:audit",
      "--",
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
    shell: process.platform === "win32",
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

function skipped(id, label, reason, required = true) {
  return {
    id,
    label,
    status: required ? "skipped-required" : "skipped",
    required,
    skipped: true,
    reason,
    nextAction: required ? "Run this check before recording final verification evidence." : null
  };
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
