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
        riskTolerance: { type: "string", enum: ["low", "medium", "high"], default: "low" }
      }
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
  return {
    endpoint: "https://example.com/api/paid",
    priceUsd: 0.01,
    hasInputSchema: true,
    hasOpenApi: true,
    hasWellKnown: true
  };
}
