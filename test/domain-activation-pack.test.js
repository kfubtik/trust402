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

test("domainActivationPack records public-safe availability evidence", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.vercel.app",
    selectedDomain: "trust402.dev",
    availabilityCheckedAt: "2026-05-20T00:19:00.000Z",
    availabilitySource: "vercel-domain-check",
    domainAvailability: [
      {
        name: "trust402.dev",
        available: true,
        price: 9.99,
        period: 1,
        purchaseUrl: "https://vercel.com/domains/search?q=trust402.dev"
      },
      {
        name: "trust402.ai",
        available: true,
        price: 160,
        period: 2
      }
    ]
  });

  assert.equal(pack.status, "ready-to-attach");
  assert.equal(pack.availability.checked, true);
  assert.equal(pack.availability.available, 2);
  assert.equal(pack.availability.totalAvailablePriceUsd, 169.99);
  assert.equal(pack.selectedDomain.status, "available-to-purchase");
  assert.equal(pack.selectedDomain.available, true);
  assert.equal(pack.selectedDomain.priceUsd, 9.99);
  assert.equal(pack.selectedDomain.periodYears, 1);
  assert.match(pack.selectedDomain.purchaseUrl, /trust402\.dev/);
  assert.equal(pack.safety.buysDomain, false);
  assert.ok(pack.nextActions[0].includes("Purchase or attach"));

  const unchecked = domainActivationPack({
    baseUrl: "https://trust402.vercel.app",
    selectedDomain: "trust402.dev"
  });
  assert.notEqual(pack.activationPackHash, unchecked.activationPackHash);
});

test("domainActivationPack blocks a checked unavailable selected domain", () => {
  const pack = domainActivationPack({
    baseUrl: "https://trust402.vercel.app",
    selectedDomain: "trust402.dev",
    selectedDomainAvailable: false,
    selectedDomainPriceUsd: 9.99
  });

  assert.equal(pack.status, "blocked");
  assert.equal(pack.selectedDomain.status, "unavailable");
  assert.ok(pack.blockers.some((blocker) => blocker.id === "selected_domain_unavailable"));
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
