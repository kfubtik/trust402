import test from "node:test";
import assert from "node:assert/strict";
import { directorySubmissionPack } from "../src/directorySubmissionPack.js";

const baseConfig = {
  publicBaseUrl: "https://trust402.vercel.app",
  cdpBazaarAllResourcesIndexed: true,
  cdpBazaarEvidenceRef: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  cdpBazaarCheckStatus: "all-indexed",
  cdpBazaarExpectedResources: 10,
  cdpBazaarIndexedResources: 10,
  cdpBazaarMissingResources: []
};

test("directorySubmissionPack exposes a public-safe custom-domain blocker", () => {
  const pack = directorySubmissionPack({}, { config: baseConfig });

  assert.equal(pack.tool, "directories.submission_pack");
  assert.equal(pack.status, "blocked-custom-domain");
  assert.equal(pack.hostPolicy.requiresCustomDomain, true);
  assert.equal(pack.cdpBazaar.ready, true);
  assert.equal(pack.safety.submitsDirectoryForms, false);
  assert.equal(pack.safety.includesSecrets, false);
  assert.ok(pack.submissionPackHash.startsWith("sha256:"));
  assert.ok(pack.directoryTargets.some((target) =>
    target.id === "x402_list_com" &&
    target.status === "blocked-manual" &&
    target.blockers.includes("custom_domain_required")
  ));
});

test("directorySubmissionPack can become ready for approved custom-domain outreach", () => {
  const pack = directorySubmissionPack({
    baseUrl: "https://trust402.dev",
    userApprovedOutreach: true
  }, { config: baseConfig });

  assert.equal(pack.status, "ready-to-submit");
  assert.equal(pack.hostPolicy.requiresCustomDomain, false);
  assert.ok(pack.summary.readyToSubmit >= 1);
  assert.ok(pack.directoryTargets.some((target) =>
    target.id === "x402_ecosystem" &&
    target.status === "ready-to-submit"
  ));
  assert.equal(pack.listingCopy.website, "https://trust402.dev");
  assert.equal(pack.evidenceEnv.TRUST402_EXTERNAL_DIRECTORY_STATUS, "visible");
});

test("directorySubmissionPack blocks outreach when CDP Bazaar evidence is missing", () => {
  const pack = directorySubmissionPack({
    baseUrl: "https://trust402.dev",
    userApprovedOutreach: true
  }, {
    config: {
      ...baseConfig,
      cdpBazaarAllResourcesIndexed: false,
      cdpBazaarEvidenceRef: ""
    }
  });

  assert.equal(pack.status, "blocked-cdp-bazaar");
  assert.equal(pack.cdpBazaar.ready, false);
  assert.ok(pack.directoryTargets.some((target) =>
    target.manualSubmissionAllowed &&
    target.blockers.includes("cdp_bazaar_not_verified")
  ));
});
