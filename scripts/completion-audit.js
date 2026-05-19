#!/usr/bin/env node
import { completionAudit } from "../src/completionAudit.js";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const target = args.find((item) => !item.startsWith("--"));

if (target) {
  const baseUrl = target.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/completion/audit`);
  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
  process.exit(strict && !body.goalComplete ? 1 : 0);
}

const audit = completionAudit();
console.log(JSON.stringify(audit, null, 2));
process.exit(strict && !audit.goalComplete ? 1 : 0);
