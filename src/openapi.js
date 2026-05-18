import { config } from "./config.js";
import { loadCatalog } from "./catalog.js";

const jsonResponse = {
  description: "JSON response",
  content: {
    "application/json": {
      schema: { type: "object" }
    }
  }
};

const errorResponse = {
  description: "Error response",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" }
            }
          }
        }
      }
    }
  }
};

export function openApiSpec() {
  const catalog = loadCatalog();
  const paths = {
    "/health": getPath("Runtime status and spend mode"),
    "/openapi.json": getPath("OpenAPI contract"),
    "/.well-known/x402": getPath("x402 discovery document"),
    "/api/capabilities": getPath("Machine-readable capability summary"),
    "/api/status": getPath("Launch readiness, safety, and backlog status"),
    "/api/launch/checklist": getPath("Dry-run launch and public marketplace readiness checklist"),
    "/api/marketplace/bundle": getPath("Marketplace submission metadata and Bazaar extension drafts"),
    "/api/settlement/status": getPath("Real x402 settlement readiness and unpaid challenge status"),
    "/api/settlement/preflight": getPath("Operator preflight for one paid settlement smoke"),
    "/api/resources": getPath("Public Trust402 resource catalog"),
    "/api/receipts/hash-result": {
      post: {
        operationId: "receipts_hash_result",
        summary: "Prepare a proof-ready SHA-256 receipt bundle without paid delegation",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("receipts.hash_result"),
              example: exampleFor("receipts.hash_result")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/receipts/notarize-result": {
      post: {
        operationId: "receipts_notarize_result",
        summary: "Preview or probe Proof402 notarization for a result hash without paid delegation",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("receipts.notarize_result"),
              example: exampleFor("receipts.notarize_result")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "403": errorResponse,
          "501": errorResponse
        }
      }
    },
    "/api/procurement/execute": {
      post: {
        operationId: "procurement_execute",
        summary: "Simulate controlled procurement execution without live spend",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("procurement.execute"),
              example: exampleFor("procurement.execute")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "403": errorResponse
        }
      }
    }
  };

  for (const resource of catalog.paidLaunchResources) {
    paths[resource.path] = {
      post: {
        operationId: resource.id.replaceAll(".", "_"),
        summary: resource.purpose,
        tags: ["Trust402"],
        "x-payment-info": paymentInfo(resource),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor(resource.id),
              example: exampleFor(resource.id)
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "402": {
            description: "Payment required when TRUST402_PAYWALL_MODE=mock"
          }
        }
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: catalog.name,
      version: config.version,
      description: catalog.positioning,
      guidance:
        "Trust402 is a dry-run-first trust router for x402 resources. Use it to check endpoints, score resources, compare candidates, plan spend, and produce diligence reports before any live procurement."
    },
    servers: [{ url: config.publicBaseUrl }],
    tags: [{ name: "Trust402" }],
    paths,
    components: {
      schemas: {
        ErrorResponse: errorResponse.content["application/json"].schema
      }
    }
  };
}

export function x402WellKnown() {
  const catalog = loadCatalog();
  return {
    version: 1,
    name: catalog.name,
    description: catalog.positioning,
    defaultMode: catalog.defaultMode,
    resources: catalog.paidLaunchResources.map((resource) => `${resource.method} ${config.publicBaseUrl}${resource.path}`),
    safety: catalog.safety,
    instructions:
      "Start with check-x402 or score-resource. Trust402 launch resources do not execute live paid subcalls; procurement execution is preserved for a later explicitly budgeted profile."
  };
}

export function capabilities() {
  const catalog = loadCatalog();
  return {
    ok: true,
    name: catalog.name,
    version: config.version,
    tagline: catalog.tagline,
    category: catalog.category,
    positioning: catalog.positioning,
    defaultMode: config.defaultMode,
    paywallMode: config.paywallMode,
    launchResources: catalog.paidLaunchResources,
    laterResourcesToPreserve: catalog.laterResourcesToPreserve,
    safety: catalog.safety,
    links: {
      health: "/health",
      resources: "/api/resources",
      status: "/api/status",
      launchChecklist: "/api/launch/checklist",
      marketplaceBundle: "/api/marketplace/bundle",
      settlementStatus: "/api/settlement/status",
      settlementPreflight: "/api/settlement/preflight",
      openapi: "/openapi.json",
      x402WellKnown: "/.well-known/x402"
    }
  };
}

function getPath(summary) {
  return {
    get: {
      summary,
      tags: ["Trust402"],
      responses: {
        "200": jsonResponse
      }
    }
  };
}

function paymentInfo(resource) {
  const price = typeof resource.priceUsd === "object"
    ? { mode: "range", currency: "USD", min: String(resource.priceUsd.min), max: String(resource.priceUsd.max) }
    : { mode: "fixed", currency: "USD", amount: String(resource.priceUsd) };

  return {
    price,
    protocols: [
      {
        x402: {
          version: 2,
          scheme: "exact",
          network: config.x402Network,
          asset: config.x402Asset,
          payTo: config.payTo
        }
      }
    ]
  };
}

function requestSchemaFor(id) {
  if (id === "trust.check_x402") {
    return {
      type: "object",
      required: ["endpoint"],
      properties: {
        endpoint: { type: "string", format: "uri" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default: "GET" },
        expectedPriceUsd: { type: "number" }
      }
    };
  }

  if (id === "procurement.plan") {
    return {
      type: "object",
      required: ["goal", "budgetUsd"],
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        maxPaidCalls: { type: "integer", default: 5 },
        riskTolerance: { type: "string", enum: ["low", "medium", "high"], default: "low" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "object" }
        }
      }
    };
  }

  if (id === "procurement.quote") {
    return {
      type: "object",
      required: ["goal", "budgetUsd"],
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        maxPaidCalls: { type: "integer", default: 5 },
        riskTolerance: { type: "string", enum: ["low", "medium", "high"], default: "low" },
        allowedRegistries: {
          type: "array",
          items: { type: "string" }
        },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "object" }
        }
      }
    };
  }

  if (id === "procurement.execute") {
    return {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["dry-run"], default: "dry-run" },
        liveSpendEnabled: { type: "boolean", default: false },
        quote: { type: "object" },
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "object" }
        }
      }
    };
  }

  if (id === "monitor.snapshot") {
    return {
      type: "object",
      properties: {
        endpoint: { type: "string", format: "uri" },
        origin: { type: "string", format: "uri" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default: "GET" },
        expectedStatus: { type: "integer" },
        expectedPriceUsd: { type: "number" },
        timeoutMs: { type: "integer" }
      },
      anyOf: [
        { required: ["endpoint"] },
        { required: ["origin"] }
      ]
    };
  }

  if (id === "monitor.badge") {
    return {
      type: "object",
      properties: {
        endpoint: { type: "string", format: "uri" },
        origin: { type: "string", format: "uri" },
        label: { type: "string" },
        snapshot: { type: "object" }
      },
      anyOf: [
        { required: ["endpoint"] },
        { required: ["origin"] },
        { required: ["snapshot"] }
      ]
    };
  }

  if (id === "trust.compare_resources") {
    return {
      type: "object",
      required: ["candidates"],
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "object" }
        }
      }
    };
  }

  if (id === "receipts.hash_result") {
    return {
      type: "object",
      properties: {
        subject: { type: "string" },
        payload: {},
        result: {},
        resultHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
        purpose: { type: "string" }
      },
      anyOf: [
        { required: ["payload"] },
        { required: ["result"] },
        { required: ["resultHash"] }
      ]
    };
  }

  if (id === "receipts.notarize_result") {
    return {
      type: "object",
      properties: {
        subject: { type: "string" },
        label: { type: "string" },
        payload: {},
        result: {},
        resultHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
        metadata: { type: "object" },
        idempotencyKey: { type: "string" },
        proof402Mode: { type: "string", enum: ["disabled", "preview", "probe", "live"] }
      },
      anyOf: [
        { required: ["payload"] },
        { required: ["result"] },
        { required: ["resultHash"] }
      ]
    };
  }

  return {
    type: "object",
    properties: {
      endpoint: { type: "string", format: "uri" },
      origin: { type: "string", format: "uri" },
      priceUsd: { type: "number" },
      hasInputSchema: { type: "boolean" },
      hasOpenApi: { type: "boolean" },
      hasWellKnown: { type: "boolean" }
    }
  };
}

function exampleFor(id) {
  if (id === "trust.check_x402") {
    return {
      endpoint: "https://example.com/api/paid",
      method: "GET"
    };
  }
  if (id === "procurement.plan") {
    return {
      goal: "Find the safest x402 resource for endpoint diligence.",
      budgetUsd: 0.25,
      maxPaidCalls: 5,
      riskTolerance: "low"
    };
  }
  if (id === "procurement.quote") {
    return {
      goal: "Buy one safe endpoint intelligence resource.",
      budgetUsd: 0.25,
      maxPaidCalls: 3,
      riskTolerance: "low",
      candidates: [
        { id: "a", endpoint: "https://example.com/a", priceUsd: 0.01, has402: true, hasInputSchema: true, hasOpenApi: true, hasWellKnown: true },
        { id: "b", endpoint: "https://example.com/b", priceUsd: 0.04, hasInputSchema: false }
      ]
    };
  }
  if (id === "procurement.execute") {
    return {
      mode: "dry-run",
      goal: "Simulate a controlled x402 procurement run.",
      budgetUsd: 0.25,
      candidates: [
        { id: "a", endpoint: "https://example.com/a", priceUsd: 0.01, has402: true, hasInputSchema: true, hasOpenApi: true, hasWellKnown: true },
        { id: "b", endpoint: "https://example.com/b", priceUsd: 0.04, hasInputSchema: false }
      ]
    };
  }
  if (id === "monitor.snapshot") {
    return {
      endpoint: "https://example.com/api/paid",
      method: "GET",
      expectedStatus: 402,
      expectedPriceUsd: 0.01
    };
  }
  if (id === "monitor.badge") {
    return {
      endpoint: "https://example.com/api/paid",
      label: "Trust402"
    };
  }
  if (id === "trust.compare_resources") {
    return {
      goal: "Choose a low-risk domain intelligence resource.",
      budgetUsd: 0.05,
      candidates: [
        { id: "a", endpoint: "https://example.com/a", priceUsd: 0.01, hasInputSchema: true, hasOpenApi: true, hasWellKnown: true },
        { id: "b", endpoint: "https://example.com/b", priceUsd: 0.03, hasInputSchema: false }
      ]
    };
  }
  if (id === "receipts.hash_result") {
    return {
      subject: "example diligence result",
      payload: {
        endpoint: "https://example.com/api/paid",
        recommendation: "test-first"
      },
      purpose: "proof-ready result hash"
    };
  }
  if (id === "receipts.notarize_result") {
    return {
      subject: "example diligence result",
      resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      label: "Trust402 diligence result",
      metadata: {
        agent: "trust402",
        taskId: "task_123"
      }
    };
  }
  return {
    endpoint: "https://example.com/api/paid",
    priceUsd: 0.01,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true
  };
}
