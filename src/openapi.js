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
    "/api/policies/spend": getPath("Spend policy gates for live procurement, Proof402 delegation, and AgentCash auto-refill"),
    "/api/payments/bridge-check": {
      post: {
        operationId: "payments_bridge_check",
        summary: "Operator-gated dry-run check for the configured live payment bridge",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("payments.bridge_check"),
              example: exampleFor("payments.bridge_check")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "403": errorResponse
        }
      }
    },
    "/api/completion/plan": getPath("Pinned autonomous buyer-agent completion plan and success criteria"),
    "/api/completion/audit": getPath("Requirement-by-requirement audit of Trust402 autonomous buyer-agent completion"),
    "/api/deployments/preflight": {
      get: {
        operationId: "deployments_preflight_get",
        summary: "Read Git/Vercel/custom-domain deployment blocker profile",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "deployments_preflight",
        summary: "Generate a public-safe deployment preflight profile from supplied evidence",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("deployments.preflight"),
              example: exampleFor("deployments.preflight")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/domains/activation-pack": {
      get: {
        operationId: "domains_activation_pack_get",
        summary: "Read custom-domain activation plan for external directory readiness",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "domains_activation_pack",
        summary: "Generate a custom-domain activation plan for a selected Trust402 domain",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("domains.activation_pack"),
              example: exampleFor("domains.activation_pack")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/directories/submission-pack": {
      get: {
        operationId: "directories_submission_pack_get",
        summary: "Read public-safe external directory submission payload and blockers",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "directories_submission_pack",
        summary: "Generate a public-safe external directory submission pack for a proposed base URL",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("directories.submission_pack"),
              example: exampleFor("directories.submission_pack")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/operator/unblock-report": {
      get: {
        operationId: "operator_unblock_report_get",
        summary: "Read current public-safe operator blockers for final Trust402 completion",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "operator_unblock_report",
        summary: "Generate a public-safe operator unblock report for a proposed live evidence window",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("operator.unblock_report"),
              example: exampleFor("operator.unblock_report")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/resources": getPath("Public Trust402 resource catalog"),
    "/api/live/window-plan": {
      post: {
        operationId: "live_window_plan",
        summary: "Generate a read-only live evidence window plan without spending or mutating policy",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("live.window_plan"),
              example: exampleFor("live.window_plan")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/operator/action-pack": {
      post: {
        operationId: "operator_action_pack",
        summary: "Generate a public-safe action pack for closing remaining operator blockers",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("operator.action_pack"),
              example: exampleFor("operator.action_pack")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/agentcash/refill-check": {
      post: {
        operationId: "agentcash_refill_check",
        summary: "Evaluate AgentCash auto-refill policy in dry-run mode or create an approved refill action",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("agentcash.refill_check"),
              example: exampleFor("agentcash.refill_check")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "403": errorResponse
        }
      }
    },
    "/api/jobs/autonomous-run": {
      post: {
        operationId: "jobs_autonomous_run",
        summary: "Run a dry-run-first autonomous Trust402 job from goal to quote, execution audit, receipt, and optional proof preview",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("jobs.autonomous_run"),
              example: exampleFor("jobs.autonomous_run")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse,
          "403": errorResponse
        }
      }
    },
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
      spendPolicy: "/api/policies/spend",
      paymentBridgeCheck: "/api/payments/bridge-check",
      completionPlan: "/api/completion/plan",
      completionAudit: "/api/completion/audit",
      deploymentPreflight: "/api/deployments/preflight",
      domainActivationPack: "/api/domains/activation-pack",
      directorySubmissionPack: "/api/directories/submission-pack",
      liveWindowPlan: "/api/live/window-plan",
      operatorUnblockReport: "/api/operator/unblock-report",
      operatorActionPack: "/api/operator/action-pack",
      agentcashRefillCheck: "/api/agentcash/refill-check",
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
          items: candidateResourceSchema()
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
          items: candidateResourceSchema()
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
          items: candidateResourceSchema()
        }
      }
    };
  }

  if (id === "jobs.autonomous_run") {
    return {
      type: "object",
      required: ["goal", "budgetUsd"],
      properties: {
        mode: { type: "string", enum: ["dry-run", "live"], default: "dry-run" },
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        maxPaidCalls: { type: "integer", default: 3 },
        riskTolerance: { type: "string", enum: ["low", "medium", "high"], default: "low" },
        includeProofPreview: { type: "boolean", default: false },
        proof402Mode: { type: "string", enum: ["disabled", "preview", "probe", "live"] },
        approval: { type: "object" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: candidateResourceSchema()
        }
      }
    };
  }

  if (id === "agentcash.refill_check") {
    return {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["dry-run", "live"], default: "dry-run" },
        currentBalanceUsd: { type: "number" },
        amountRefilledTodayUsd: { type: "number", default: 0 }
      }
    };
  }

  if (id === "payments.bridge_check") {
    return {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["agentcash-mcp", "external-adapter"], default: "agentcash-mcp" },
        candidateEndpoint: { type: "string", format: "uri" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], default: "POST" },
        maxAmountUsd: { type: "number", default: 0.01 },
        body: {}
      }
    };
  }

  if (id === "live.window_plan") {
    return {
      type: "object",
      required: ["candidateEndpoint", "candidatePriceUsd", "maxTotalUsd"],
      properties: {
        baseUrl: { type: "string", format: "uri" },
        candidateEndpoint: { type: "string", format: "uri" },
        candidatePriceUsd: { type: "number" },
        maxTotalUsd: { type: "number" },
        manualSmokeBudgetUsd: { type: "number" },
        paymentProvider: { type: "string", enum: ["agentcash-mcp", "x402-fetch", "external-adapter"] },
        allowedRegistries: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        },
        proofReserveUsd: { type: "number" },
        includeProof: { type: "boolean", default: true },
        includeAutonomous: { type: "boolean", default: false },
        includeAutoRefill: { type: "boolean", default: false },
        liveMaxPerCallUsd: { type: "number" },
        liveMaxPerJobUsd: { type: "number" },
        liveDailyLimitUsd: { type: "number" },
        liveSpentTodayUsd: { type: "number", default: 0 },
        lastVerifiedBalanceUsd: { type: "number" },
        minimumReserveUsd: { type: "number" }
      }
    };
  }

  if (id === "directories.submission_pack") {
    return {
      type: "object",
      properties: {
        baseUrl: { type: "string", format: "uri" },
        userApprovedOutreach: { type: "boolean", default: false }
      }
    };
  }

  if (id === "domains.activation_pack") {
    return {
      type: "object",
      properties: {
        baseUrl: { type: "string", format: "uri" },
        selectedDomain: { type: "string" },
        candidateDomains: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        },
        vercelProjectName: { type: "string", default: "trust402" }
      }
    };
  }

  if (id === "deployments.preflight") {
    return {
      type: "object",
      properties: {
        baseUrl: { type: "string", format: "uri" },
        customDomain: { type: "string" },
        gitRemote: { type: "string" },
        gitHead: { type: "string" },
        vercelProject: { type: "object" },
        productionDeployWorkflowText: { type: "string" },
        launchMonitorWorkflowText: { type: "string" },
        vercelGitConnected: { type: "boolean" },
        githubActionsSecretsConfigured: { type: "boolean" },
        gitAutoDeployVerified: { type: "boolean" },
        gitAutoDeployEvidenceUrl: { type: "string", format: "uri" },
        gitAutoDeployCommitSha: { type: "string" },
        githubCli: { type: "object" },
        vercelDeployment: { type: "object" }
      }
    };
  }

  if (id === "operator.action_pack") {
    return operatorPlanningSchema();
  }

  if (id === "operator.unblock_report") {
    return operatorPlanningSchema();
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
          items: candidateResourceSchema()
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

function operatorPlanningSchema() {
  return {
    type: "object",
    properties: {
      baseUrl: { type: "string", format: "uri" },
      candidateEndpoint: { type: "string", format: "uri" },
      candidatePriceUsd: { type: "number" },
      proofReserveUsd: { type: "number" },
      maxTotalUsd: { type: "number" },
      paymentProvider: { type: "string", enum: ["agentcash-mcp", "x402-fetch", "external-adapter"] },
      includeProof: { type: "boolean", default: true },
      includeAutonomous: { type: "boolean", default: false },
      includeAutoRefill: { type: "boolean", default: false },
      includeRefillLive: { type: "boolean", default: false },
      liveSpentTodayUsd: { type: "number", default: 0 }
    }
  };
}

function candidateResourceSchema() {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { type: "string", description: "Stable candidate identifier used in rankings and receipts." },
      name: { type: "string", description: "Human-readable resource name." },
      endpoint: { type: "string", format: "uri", description: "HTTPS x402 resource endpoint." },
      url: { type: "string", format: "uri", description: "Alternate field for the x402 resource endpoint." },
      priceUsd: {
        oneOf: [{ type: "number", minimum: 0 }, { type: "string" }],
        description: "Advertised resource price in USD."
      },
      price: {
        oneOf: [{ type: "number", minimum: 0 }, { type: "string" }],
        description: "Alternate price field accepted by Trust402."
      },
      has402: { type: "boolean", description: "Whether the endpoint is known to return an x402 challenge." },
      hasInputSchema: { type: "boolean", description: "Whether structured input schema metadata is available." },
      hasOpenApi: { type: "boolean", description: "Whether the origin publishes OpenAPI metadata." },
      hasWellKnown: { type: "boolean", description: "Whether the origin publishes /.well-known/x402 discovery." },
      inputSchema: { type: "object", description: "Optional embedded input schema for the candidate." },
      openapiUrl: { type: "string", format: "uri" },
      wellKnownUrl: { type: "string", format: "uri" },
      payTo: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      network: { type: "string", description: "x402 payment network, for example eip155:8453." },
      asset: { type: "string", description: "Payment asset address or symbol." },
      description: { type: "string", description: "Buyer-facing explanation of the resource." },
      receiptReady: { type: "boolean", description: "Whether the candidate can return receipt/proof-ready output." },
      proofReady: { type: "boolean", description: "Alternate receipt/proof readiness signal." },
      observed: { type: "object", description: "Optional probe observations such as status or latency." },
      x402: { type: "object", description: "Optional parsed x402 challenge metadata." },
      accept: { type: "object", description: "Optional single x402 accept object." },
      metadata: { type: "object", description: "Additional public-safe metadata used during scoring." }
    },
    anyOf: [
      { required: ["endpoint"] },
      { required: ["url"] }
    ]
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
  if (id === "jobs.autonomous_run") {
    return {
      mode: "dry-run",
      goal: "Choose and audit the safest x402 resource for endpoint diligence.",
      budgetUsd: 0.25,
      maxPaidCalls: 2,
      riskTolerance: "low",
      includeProofPreview: true,
      candidates: [
        { id: "a", endpoint: "https://example.com/a", priceUsd: 0.01, has402: true, hasInputSchema: true, hasOpenApi: true, hasWellKnown: true },
        { id: "b", endpoint: "https://example.com/b", priceUsd: 0.04, hasInputSchema: false }
      ]
    };
  }
  if (id === "agentcash.refill_check") {
    return {
      mode: "dry-run",
      currentBalanceUsd: 0.42,
      amountRefilledTodayUsd: 0
    };
  }
  if (id === "payments.bridge_check") {
    return {
      provider: "agentcash-mcp",
      candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
      method: "POST",
      maxAmountUsd: 0.01
    };
  }
  if (id === "live.window_plan") {
    return {
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://approved.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.03,
      paymentProvider: "agentcash-mcp",
      includeProof: true
    };
  }
  if (id === "directories.submission_pack") {
    return {
      baseUrl: "https://trust402.vercel.app",
      userApprovedOutreach: false
    };
  }
  if (id === "domains.activation_pack") {
    return {
      baseUrl: "https://trust402.vercel.app",
      selectedDomain: "trust402.dev",
      candidateDomains: ["trust402.dev", "trust402.xyz", "trust402.org"]
    };
  }
  if (id === "deployments.preflight") {
    return {
      baseUrl: "https://trust402.vercel.app",
      customDomain: "trust402.dev",
      gitRemote: "https://github.com/kfubtik/trust402.git",
      gitHead: "43b96cf",
      vercelProject: {
        projectName: "trust402",
        projectId: "prj_...",
        orgId: "team_..."
      },
      gitAutoDeployVerified: false
    };
  }
  if (id === "operator.action_pack") {
    return {
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://approved.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.03,
      includeProof: true
    };
  }
  if (id === "operator.unblock_report") {
    return {
      baseUrl: "https://trust402.vercel.app",
      candidatePriceUsd: 0.01,
      proofReserveUsd: 0.01,
      includeProof: true,
      includeAutonomous: false
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
