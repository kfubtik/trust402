import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { openApiSpec } from "./openapi.js";
import { launchChecklist } from "./readiness.js";
import { settlementStatus } from "./settlement.js";

export function marketplaceBundle() {
  const catalog = loadCatalog();
  const openapi = openApiSpec();
  const checklist = launchChecklist();
  const settlement = settlementStatus({ catalog });
  const listingState = marketplaceListingState(checklist, settlement);
  const resources = catalog.paidLaunchResources.map((resource) =>
    marketplaceResource(resource, openapi, checklist, settlement)
  );

  return {
    ok: true,
    tool: "marketplace.bundle",
    generatedAt: new Date().toISOString(),
    name: catalog.name,
    tagline: catalog.tagline,
    category: catalog.category,
    positioning: catalog.positioning,
    defaultMode: config.defaultMode,
    publicBaseUrl: config.publicBaseUrl,
    listingState,
    indexing: indexingPlan(settlement, listingState),
    discovery: {
      health: `${config.publicBaseUrl}/health`,
      resources: `${config.publicBaseUrl}/api/resources`,
      status: `${config.publicBaseUrl}/api/status`,
      launchChecklist: `${config.publicBaseUrl}/api/launch/checklist`,
      marketplaceBundle: `${config.publicBaseUrl}/api/marketplace/bundle`,
      settlementStatus: `${config.publicBaseUrl}/api/settlement/status`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      x402WellKnown: `${config.publicBaseUrl}/.well-known/x402`,
      x402WellKnownJson: `${config.publicBaseUrl}/.well-known/x402.json`,
      agentManifest: `${config.publicBaseUrl}/.well-known/agent.json`,
      agentServices: `${config.publicBaseUrl}/.well-known/agent-services.json`,
      aiPlugin: `${config.publicBaseUrl}/.well-known/ai-plugin.json`,
      mcpManifest: `${config.publicBaseUrl}/.well-known/mcp.json`,
      llms: `${config.publicBaseUrl}/llms.txt`,
      robots: `${config.publicBaseUrl}/robots.txt`,
      sitemap: `${config.publicBaseUrl}/sitemap.xml`
    },
    submissionChecklist: checklist,
    settlement,
    resources,
    notes: [
      "Use this bundle to prepare marketplace copy, Bazaar extension declarations, and buyer-facing resource metadata.",
      listingState.cdpBazaarIndexingReady
        ? "Trust402 is eligible for CDP Bazaar indexing; the external catalog is asynchronous, so confirm visibility with npm run bazaar:indexing:check."
        : "Do not claim CDP Bazaar listing until at least one real x402 settlement has completed for a Bazaar-enabled route.",
      "Keep live spend disabled until wallet policy, allowlists, receipt logs, and paid smoke limits are approved."
    ]
  };
}

function marketplaceListingState(checklist, settlement) {
  return {
    dryRunMetadataReady: checklist.readiness.dryRunLaunchReady,
    publicMarketplaceReady: checklist.readiness.publicMarketplaceReady,
    realSettlementReady: settlement.readiness.realSettlementReady,
    cdpBazaarIndexingReady: settlement.readiness.marketplaceIndexingReady,
    cdpBazaarIndexed: null,
    reason: settlement.readiness.marketplaceIndexingReady
      ? "Real x402 settlement is configured and at least one successful settlement has been observed; CDP Bazaar catalog visibility is asynchronous and must be checked externally."
      : "CDP Bazaar discovery indexes routes after a successful x402 settle through the facilitator. Trust402 currently exports metadata but keeps real settlement disabled or unproven."
  };
}

function indexingPlan(settlement, listingState) {
  const bazaarCheck = settlement.checks.find((item) => item.id === "bazaar_metadata_present");
  return {
    cdpBazaar: {
      status: listingState.cdpBazaarIndexingReady ? "eligible" : "blocked",
      indexed: listingState.cdpBazaarIndexed,
      requirements: {
        bazaarExtensionDeclared: bazaarCheck?.passed === true,
        cdpFacilitatorSelected: settlement.facilitator.cdp.selected === true,
        successfulSettlementObserved: settlement.mode.successfulSettlementObserved === true,
        realSettlementReady: settlement.readiness.realSettlementReady === true,
        paymentPayloadResourceRequired: true
      },
      discoveryCheck: {
        command: "npm run bazaar:indexing:check -- https://trust402.vercel.app",
        cdnOrCatalogLagExpected: true
      }
    },
    externalDirectories: [
      {
        name: "x402 ecosystem",
        url: "https://www.x402.org/ecosystem",
        mode: "manual-submission"
      },
      {
        name: "x402scan",
        url: "https://www.x402scan.com/",
        mode: "crawler-or-directory"
      },
      {
        name: "x402 Bazaar",
        url: "https://docs.cdp.coinbase.com/x402/bazaar",
        mode: "settlement-indexed"
      },
      {
        name: "Agora402",
        url: "https://agora402.io/",
        mode: "registry-or-search"
      }
    ]
  };
}

function marketplaceResource(resource, openapi, checklist, settlement) {
  const operation = openapi.paths?.[resource.path]?.[resource.method.toLowerCase()] || {};
  const jsonBody = operation.requestBody?.content?.["application/json"] || {};
  const inputSchema = jsonBody.schema || { type: "object" };
  const inputExample = jsonBody.example || {};
  const outputExample = outputExampleFor(resource.id);
  const listingBlockers = resourceListingBlockers(checklist, settlement);

  return {
    id: resource.id,
    method: resource.method,
    path: resource.path,
    resource: `${config.publicBaseUrl}${resource.path}`,
    type: "http",
    x402Version: 2,
    description: resource.purpose,
    priceUsd: resource.priceUsd,
    accepts: [paymentRequirement(resource)],
    metadata: {
      title: resource.id,
      description: resource.purpose,
      category: "x402-trust",
      tags: tagsFor(resource),
      input: {
        type: "http",
        method: resource.method,
        body: inputExample
      },
      inputSchema,
      output: {
        type: "json",
        example: outputExample,
        schema: outputSchemaFor(outputExample)
      },
      safety: {
        liveSpendEnabled: false,
        paidSubcallsEnabled: false,
        storesPrivateKeys: false,
        proofReady: resource.id === "reports.x402_diligence" || resource.id.startsWith("monitor.")
      }
    },
    bazaarExtensionDraft: bazaarExtensionDraft(resource, inputSchema, inputExample, outputExample),
    listingStatus: listingBlockers.length === 0 ? "ready-for-indexing-check" : "blocked",
    listingBlockers,
    nextListingAction: listingBlockers.length === 0
      ? "Wait for asynchronous CDP Bazaar indexing or run npm run bazaar:indexing:check to confirm visibility."
      : "Resolve listingBlockers before submitting this resource to public directories."
  };
}

function resourceListingBlockers(checklist, settlement) {
  const blockers = [];
  if (!checklist.readiness.dryRunLaunchReady) {
    blockers.push("Complete dry-run launch metadata and resource coverage.");
  }
  if (!checklist.readiness.publicMarketplaceReady) {
    blockers.push(...checklist.blockers.map((item) => item.message));
  }
  if (!settlement.readiness.marketplaceIndexingReady) {
    blockers.push("Complete a successful CDP facilitator settlement for at least one Bazaar-enabled route before expecting Bazaar indexing.");
  }
  return Array.from(new Set(blockers));
}

function bazaarExtensionDraft(resource, inputSchema, inputExample, outputExample) {
  return {
    bazaar: {
      info: {
        input: {
          type: "http",
          method: resource.method,
          body: inputExample
        },
        output: {
          type: "json",
          example: outputExample
        }
      },
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          input: inputSchema,
          output: outputSchemaFor(outputExample)
        }
      }
    }
  };
}

function paymentRequirement(resource) {
  return {
    scheme: "exact",
    network: config.x402Network,
    asset: config.x402Asset,
    amount: priceToBaseUnits(resource.priceUsd),
    payTo: config.payTo,
    maxTimeoutSeconds: 300
  };
}

function priceToBaseUnits(priceUsd) {
  const price = typeof priceUsd === "object" ? priceUsd.max : priceUsd;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.round(parsed * 1_000_000));
}

function tagsFor(resource) {
  const tags = new Set(["x402", "trust402", "trust"]);
  if (resource.id.startsWith("procurement.")) tags.add("procurement");
  if (resource.id.startsWith("monitor.")) tags.add("monitoring");
  if (resource.id.startsWith("seller.")) tags.add("seller-readiness");
  if (resource.id.startsWith("reports.")) tags.add("diligence");
  return Array.from(tags);
}

function outputExampleFor(id) {
  if (id === "trust.check_x402") {
    return {
      ok: true,
      tool: "trust.check_x402",
      recommendation: "payment-flow-ready",
      x402: { x402Version: 2, accepts: [] }
    };
  }
  if (id === "trust.score_resource") {
    return {
      ok: true,
      tool: "trust.score_resource",
      score: 88,
      riskLevel: "low",
      recommendation: "use"
    };
  }
  if (id === "trust.compare_resources") {
    return {
      ok: true,
      tool: "trust.compare_resources",
      recommendation: { id: "candidate-1", rank: 1 }
    };
  }
  if (id === "procurement.plan") {
    return {
      ok: true,
      tool: "procurement.plan",
      policy: { mode: "plan-only", liveSpendEnabled: false }
    };
  }
  if (id === "procurement.quote") {
    return {
      ok: true,
      tool: "procurement.quote",
      approvalPayload: { liveSpendEnabled: false }
    };
  }
  if (id.startsWith("monitor.")) {
    return {
      ok: true,
      tool: id,
      policy: { storesHistory: false, paidSubcallsMade: 0 }
    };
  }
  if (id === "reports.x402_diligence") {
    return {
      ok: true,
      tool: "reports.x402_diligence",
      evidenceHash: "sha256:...",
      recommendation: "test-first"
    };
  }
  return {
    ok: true,
    tool: id
  };
}

function outputSchemaFor(example) {
  const properties = {};
  for (const [key, value] of Object.entries(example)) {
    properties[key] = schemaForValue(value);
  }
  return {
    type: "object",
    properties
  };
}

function schemaForValue(value) {
  if (Array.isArray(value)) return { type: "array" };
  if (value && typeof value === "object") return { type: "object" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") return { type: "number" };
  return { type: "string" };
}
