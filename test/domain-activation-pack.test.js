import test from "node:test";
import assert from "node:assert/strict";
import { domainActivationPack } from "../src/domainActivationPack.js";

test("domainActivationPack blocks vercel.app until a domain is selected", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.vercel.app"
  });

  assert.equal(pack.tool, "domains.activation_pack");
  assert.equal(pack.status, "blocked");
  assert.equal(pack.currentHost.ready, false);
  assert.ok(pack.blockers.some((blocker) => blocker.id === "selected_domain_not_confirmed"));
  assert.equal(pack.availability.checked, false);
  assert.equal(pack.safety.buysDomain, false);
  assert.equal(pack.safety.mutatesVercel, false);
});

test("domainActivationPack prepares PUBLIC_BASE_URL for an accepted selected domain", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.vercel.app",
    selectedDomain: "trust402.dev"
  });

  assert.equal(pack.status, "ready-to-attach");
  assert.equal(pack.selectedDomain.domain, "trust402.dev");
  assert.equal(pack.selectedDomain.acceptedByPolicy, true);
  assert.equal(pack.vercelPlan.envPlan.PUBLIC_BASE_URL, "https://trust402.dev");
  assert.ok(pack.vercelPlan.verifyCommands.some((command) => command.includes("trust402.dev")));
  assert.equal(pack.directoryImpact.unlocksFreeHostingBlockedTargets, true);
});

test("domainActivationPack rejects selected free-hosting domains", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.vercel.app",
    selectedDomain: "demo.vercel.app"
  });

  assert.equal(pack.status, "blocked");
  assert.equal(pack.selectedDomain.acceptedByPolicy, false);
  assert.ok(pack.blockers.some((blocker) => blocker.id === "selected_domain_not_accepted"));
});

test("domainActivationPack treats an existing custom base URL as domain-ready", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.dev"
  });

  assert.equal(pack.status, "ready-to-attach");
  assert.equal(pack.currentHost.ready, true);
  assert.deepEqual(pack.blockers, []);
  assert.equal(pack.vercelPlan.envPlan.PUBLIC_BASE_URL, "https://trust402.dev");
});
