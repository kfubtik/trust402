import { config } from "./config.js";
import { loadCatalog } from "./catalog.js";
import { indexingRoutes } from "./indexingRoutes.js";
import { mcpServerManifest, mcpTools } from "./mcpWrapper.js";

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
    "/.well-known/x402.json": getPath("x402 discovery document JSON alias"),
    "/.well-known/agent.json": getPath("Agent manifest for directories and autonomous buyers"),
    "/.well-known/agent-services.json": getPath("Agent services manifest for crawler ingestion"),
    "/.well-known/ai-plugin.json": getPath("OpenAPI plugin-style discovery manifest"),
    "/.well-known/mcp.json": getPath("MCP discovery placeholder and OpenAPI/x402 pointers"),
    "/mcp": {
      get: {
        operationId: "mcp_manifest_get",
        summary: "Trust402 MCP wrapper manifest",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "mcp_jsonrpc",
        summary: "Trust402 MCP JSON-RPC wrapper for paid x402 request packages",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["jsonrpc", "method"],
                properties: {
                  jsonrpc: { type: "string", const: "2.0" },
                  id: {},
                  method: { type: "string" },
                  params: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/directory": textPath("Crawler-friendly public directory profile", "text/html"),
    "/directory.json": getPath("Public-safe directory profile JSON"),
    "/radar": textPath("Public Trust402 Radar page with primary paid offers and daily digest evidence", "text/html"),
    "/radar.json": getPath("Public-safe Trust402 Radar daily digest JSON"),
    "/api/radar/ecosystem-pulse": getPath("Public-safe x402/Base ecosystem pulse for buyer agents"),
    "/ecosystem": textPath("Public Base/x402 ecosystem trend intelligence page", "text/html"),
    "/api/ecosystem/trends": getPath("Public-safe Base/x402 ecosystem trend intelligence for buyer agents"),
    "/api/mcp/tools": getPath("Trust402 MCP tool catalog for Base MCP, Hermes, Codex, and buyer agents"),
    "/api/indexing/routes": getPath("Route-level indexing feed for paid x402 resources and external marketplaces"),
    "/api/bazaar/reindex-window": {
      get: {
        operationId: "bazaar_reindex_window_get",
        summary: "Generate the default read-only CDP Bazaar route-level reindex window plan",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      },
      post: {
        operationId: "bazaar_reindex_window",
        summary: "Generate a controlled route-by-route CDP Bazaar reindex/evidence window plan without spending",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("bazaar.reindex_window"),
              example: exampleFor("bazaar.reindex_window")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/resources/{slug}": textPath("Crawler-friendly route-level paid resource page", "text/html"),
    "/llms.txt": textPath("LLM-readable Trust402 discovery and safety summary", "text/plain"),
    "/robots.txt": textPath("Crawler policy and sitemap pointer", "text/plain"),
    "/sitemap.xml": textPath("Sitemap for public discovery surfaces", "application/xml"),
    "/api/capabilities": getPath("Machine-readable capability summary"),
    "/api/status": getPath("Launch readiness, safety, and backlog status"),
    "/api/launch/checklist": getPath("Dry-run launch and public marketplace readiness checklist"),
    "/api/marketplace/bundle": getPath("Marketplace submission metadata and Bazaar extension drafts"),
    "/api/settlement/status": getPath("Real x402 settlement readiness and unpaid challenge status"),
    "/api/settlement/preflight": getPath("Operator preflight for one paid settlement smoke"),
    "/api/policies/spend": getPath("Spend policy gates for live procurement, Proof402 delegation, and AgentCash auto-refill"),
    "/api/payments/buyer-preflight": {
      post: {
        operationId: "payments_buyer_preflight",
        summary: "Read-only CDP x402 buyer account readiness and optional operator-gated account probe",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("payments.buyer_preflight"),
              example: exampleFor("payments.buyer_preflight")
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
    "/api/proof402/preflight": {
      post: {
        operationId: "proof402_preflight",
        summary: "Read-only paid Proof402 delegation preflight for approved hashes, quote caps, and live policy",
        tags: ["Trust402"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchemaFor("proof402.preflight"),
              example: exampleFor("proof402.preflight")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
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
    "/api/deployments/github-actions-setup": {
      get: {
        operationId: "deployments_github_actions_setup_get",
        summary: "Read public-safe GitHub Actions setup commands for Vercel production deploy",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "deployments_github_actions_setup",
        summary: "Generate public-safe GitHub Actions setup commands from supplied project evidence",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("deployments.github_actions_setup"),
              example: exampleFor("deployments.github_actions_setup")
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
    "/api/domains/readiness-check": {
      get: {
        operationId: "domains_readiness_check_get",
        summary: "Read custom-domain readiness check for the configured public base URL",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "domains_readiness_check",
        summary: "Verify a custom domain through DNS, HTTPS health, x402 discovery, and unpaid x402 challenge checks",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("domains.readiness_check"),
              example: exampleFor("domains.readiness_check")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/directories/profile": getPath("Public-safe directory profile JSON for crawlers and external listings"),
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
    "/api/operator/readiness": {
      get: {
        operationId: "operator_readiness_get",
        summary: "Read a public-safe production readiness profile for live evidence blockers",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "operator_readiness",
        summary: "Generate a public-safe operator readiness profile for a proposed live evidence window",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("operator.readiness"),
              example: exampleFor("operator.readiness")
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
    "/api/radar/digest": getPath("Public-safe Trust402 Radar daily digest JSON"),
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
    "/api/registries/candidates": {
      get: {
        operationId: "registries_candidates_get",
        summary: "Read trusted seed x402 candidates for autonomous job planning",
        tags: ["Trust402"],
        responses: {
          "200": jsonResponse
        }
      },
      post: {
        operationId: "registries_candidates",
        summary: "Resolve explicit, registry-provided, and trusted seed x402 candidates without spending",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("registries.candidates"),
              example: exampleFor("registries.candidates")
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
    "/api/agentcash/mcp-observation": {
      post: {
        operationId: "agentcash_mcp_observation",
        summary: "Validate observed AgentCash MCP accounts/settings against the Trust402 local wallet policy",
        tags: ["Trust402"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: requestSchemaFor("agentcash.mcp_observation"),
              example: exampleFor("agentcash.mcp_observation")
            }
          }
        },
        responses: {
          "200": jsonResponse,
          "400": errorResponse
        }
      }
    },
    "/api/jobs/autonomous-run": {
      post: {
        operationId: "jobs_autonomous_run",
        summary: "Run a dry-run-first autonomous Trust402 job from goal to candidate discovery, quote, execution audit, receipt, and optional proof preview",
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
  const endpoints = catalog.paidLaunchResources.map((resource) => endpointDiscoveryRecord(resource));
  return {
    version: 1,
    x402Version: 2,
    name: catalog.name,
    provider: catalog.name,
    description: catalog.positioning,
    tagline: catalog.tagline,
    category: catalog.category,
    defaultMode: catalog.defaultMode,
    resources: endpoints.map((endpoint) => endpoint.url),
    endpoints,
    categories: {
      trust: endpoints.filter((endpoint) => endpoint.category === "trust").map((endpoint) => endpoint.path),
      procurement: endpoints.filter((endpoint) => endpoint.category === "procurement").map((endpoint) => endpoint.path),
      monitoring: endpoints.filter((endpoint) => endpoint.category === "monitoring").map((endpoint) => endpoint.path),
      diligence: endpoints.filter((endpoint) => endpoint.category === "diligence").map((endpoint) => endpoint.path),
      seller: endpoints.filter((endpoint) => endpoint.category === "seller").map((endpoint) => endpoint.path)
    },
    openapi: `${config.publicBaseUrl}/openapi.json`,
    capabilities: `${config.publicBaseUrl}/api/capabilities`,
    marketplaceBundle: `${config.publicBaseUrl}/api/marketplace/bundle`,
    llms: `${config.publicBaseUrl}/llms.txt`,
    ownershipProofs: [],
    safety: catalog.safety,
    instructions:
      "Start with check-x402 or score-resource. Trust402 launch resources are paid x402 resources for buyer-side trust, diligence, monitoring, and procurement planning. Live downstream procurement is disabled unless an operator explicitly enables budgets, allowlists, receipts, and payment-provider policy."
  };
}

export function agentManifest() {
  const catalog = loadCatalog();
  return {
    schemaVersion: "0.1",
    name: catalog.name,
    description: catalog.positioning,
    tagline: catalog.tagline,
    category: catalog.category,
    url: config.publicBaseUrl,
    provider: {
      name: "Trust402",
      url: config.publicBaseUrl
    },
    capabilities: [
      "x402 endpoint probing",
      "resource trust scoring",
      "origin readiness evaluation",
      "candidate comparison",
      "bounded procurement planning",
      "hash-ready diligence reports",
      "Proof402 preview and paid-delegation gating",
      "Proof402 paid-proof preflight for approved hashes and quote caps",
      "AgentCash balance/refill policy checks"
    ],
    discovery: discoveryLinks(),
    resources: x402WellKnown().endpoints,
    safety: {
      ...catalog.safety,
      dryRunFirst: true,
      liveSpendRequiresOperatorPolicy: true,
      publicManifestsContainSecrets: false
    },
    contact: {
      repository: "https://github.com/kfubtik/trust402",
      directoryProfile: `${config.publicBaseUrl}/directory`,
      directoryProfileJson: `${config.publicBaseUrl}/directory.json`,
      directorySubmissionPack: `${config.publicBaseUrl}/api/directories/submission-pack`
    }
  };
}

export function agentServicesManifest() {
  const agent = agentManifest();
  return {
    version: 1,
    services: [
      {
        id: "trust402",
        name: agent.name,
        description: agent.description,
        url: agent.url,
        protocol: "x402",
        openapi: agent.discovery.openapi,
        x402: agent.discovery.x402,
        resources: agent.resources
      }
    ]
  };
}

export function aiPluginManifest() {
  const catalog = loadCatalog();
  return {
    schema_version: "v1",
    name_for_human: catalog.name,
    name_for_model: "trust402",
    description_for_human: catalog.positioning,
    description_for_model:
      "Use Trust402 to evaluate x402 endpoints, compare paid resources, plan bounded procurement, create hash-ready diligence reports, and inspect spend policy before any live buyer spend.",
    auth: {
      type: "none"
    },
    api: {
      type: "openapi",
      url: `${config.publicBaseUrl}/openapi.json`,
      is_user_authenticated: false
    },
    logo_url: `${config.publicBaseUrl}/api/monitor/badge`,
    contact_email: "operator@trust402.local",
    legal_info_url: `${config.publicBaseUrl}/api/status`
  };
}

export function mcpManifest() {
  return {
    mcpServers: {
      trust402: {
        transport: "streamable-http",
        url: `${config.publicBaseUrl}/mcp`
      }
    },
    server: mcpServerManifest(),
    tools: mcpTools(),
    note: "Trust402 MCP tools prepare paid x402 request packages. They do not bypass payment or execute paid resources for free.",
    discovery: discoveryLinks(),
    safety: {
      includesSecrets: false,
      liveSpendEnabledByDefault: false,
      sendsPaymentHeaders: false,
      bypassesX402Payment: false
    }
  };
}

export function llmsText() {
  const catalog = loadCatalog();
  const endpoints = x402WellKnown().endpoints;
  const lines = [
    "# Trust402",
    "",
    `${catalog.tagline}`,
    "",
    "Trust402 is a buyer-side trust and procurement agent for x402 resources.",
    "Use it to probe x402 endpoints, score resources, compare candidates, plan spend, monitor payment-flow drift, and produce hash-ready diligence reports.",
    "",
    "## Discovery",
    "",
    `- Website: ${config.publicBaseUrl}`,
    `- OpenAPI: ${config.publicBaseUrl}/openapi.json`,
    `- Directory profile: ${config.publicBaseUrl}/directory`,
    `- Directory profile JSON: ${config.publicBaseUrl}/directory.json`,
    `- Trust402 Radar: ${config.publicBaseUrl}/radar`,
    `- Radar digest JSON: ${config.publicBaseUrl}/radar.json`,
    `- Ecosystem pulse JSON: ${config.publicBaseUrl}/api/radar/ecosystem-pulse`,
    `- Ecosystem trends: ${config.publicBaseUrl}/ecosystem`,
    `- Ecosystem trends JSON: ${config.publicBaseUrl}/api/ecosystem/trends`,
    `- MCP manifest: ${config.publicBaseUrl}/.well-known/mcp.json`,
    `- MCP endpoint: ${config.publicBaseUrl}/mcp`,
    `- MCP tools: ${config.publicBaseUrl}/api/mcp/tools`,
    `- Route indexing feed: ${config.publicBaseUrl}/api/indexing/routes`,
    `- Bazaar reindex window plan: ${config.publicBaseUrl}/api/bazaar/reindex-window`,
    `- x402 discovery: ${config.publicBaseUrl}/.well-known/x402`,
    `- x402 discovery JSON alias: ${config.publicBaseUrl}/.well-known/x402.json`,
    `- Agent manifest: ${config.publicBaseUrl}/.well-known/agent.json`,
    `- Resource catalog: ${config.publicBaseUrl}/api/resources`,
    `- Marketplace bundle: ${config.publicBaseUrl}/api/marketplace/bundle`,
    `- Spend policy: ${config.publicBaseUrl}/api/policies/spend`,
    "",
    "## Paid x402 Resources",
    ""
  ];
  for (const endpoint of endpoints) {
    lines.push(`- ${endpoint.method} ${endpoint.url} - ${endpoint.price_usd} USD - ${endpoint.description}`);
  }
  lines.push(
    "",
    "## Safety",
    "",
    "- Live downstream procurement is disabled by default.",
    "- Paid Proof402 delegation is disabled until explicit operator policy is configured.",
    "- AgentCash auto-refill is disabled until provider, threshold, daily cap, audit log, and emergency stop are approved.",
    "- Public discovery documents do not include secrets, private keys, payment headers, or local wallet policy."
  );
  return `${lines.join("\n")}\n`;
}

export function robotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${config.publicBaseUrl}/sitemap.xml`,
    ""
  ].join("\n");
}

export function sitemapXml() {
  const urls = [
    "/",
    "/health",
    "/openapi.json",
    "/.well-known/x402",
    "/.well-known/x402.json",
    "/.well-known/agent.json",
    "/.well-known/agent-services.json",
    "/.well-known/ai-plugin.json",
    "/.well-known/mcp.json",
    "/mcp",
    "/directory",
    "/directory.json",
    "/radar",
    "/radar.json",
    "/ecosystem",
    "/llms.txt",
    "/api/resources",
    "/api/radar/digest",
    "/api/radar/ecosystem-pulse",
    "/api/ecosystem/trends",
    "/api/mcp/tools",
    "/api/indexing/routes",
    "/api/bazaar/reindex-window",
    "/api/capabilities",
    "/api/status",
    "/api/marketplace/bundle",
    "/api/directories/profile",
    "/api/directories/submission-pack",
    "/api/deployments/github-actions-setup",
    "/api/registries/candidates",
    "/api/proof402/preflight",
    ...loadCatalog().paidLaunchResources.map((resource) => resource.path),
    ...indexingRoutes().records.map((record) => `/resources/${record.slug}`)
  ];
  const body = urls.map((path) => `  <url><loc>${xmlEscape(`${config.publicBaseUrl}${path}`)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
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
      proof402Preflight: "/api/proof402/preflight",
      completionPlan: "/api/completion/plan",
      completionAudit: "/api/completion/audit",
      deploymentPreflight: "/api/deployments/preflight",
      githubActionsSetup: "/api/deployments/github-actions-setup",
      domainActivationPack: "/api/domains/activation-pack",
      directoryProfile: "/directory",
      directoryProfileJson: "/directory.json",
      radar: "/radar",
      radarJson: "/radar.json",
      radarDigest: "/api/radar/digest",
      ecosystemPulse: "/api/radar/ecosystem-pulse",
      ecosystem: "/ecosystem",
      ecosystemTrends: "/api/ecosystem/trends",
      mcp: "/mcp",
      mcpTools: "/api/mcp/tools",
      indexingRoutes: "/api/indexing/routes",
      bazaarReindexWindow: "/api/bazaar/reindex-window",
      apiDirectoryProfile: "/api/directories/profile",
      directorySubmissionPack: "/api/directories/submission-pack",
      liveWindowPlan: "/api/live/window-plan",
      operatorUnblockReport: "/api/operator/unblock-report",
      operatorActionPack: "/api/operator/action-pack",
      registryCandidates: "/api/registries/candidates",
      agentcashRefillCheck: "/api/agentcash/refill-check",
      openapi: "/openapi.json",
      x402WellKnown: "/.well-known/x402",
      x402WellKnownJson: "/.well-known/x402.json",
      agentManifest: "/.well-known/agent.json",
      agentServices: "/.well-known/agent-services.json",
      aiPlugin: "/.well-known/ai-plugin.json",
      mcpManifest: "/.well-known/mcp.json",
      llms: "/llms.txt",
      robots: "/robots.txt",
      sitemap: "/sitemap.xml"
    }
  };
}

function discoveryLinks() {
  return {
    health: `${config.publicBaseUrl}/health`,
    openapi: `${config.publicBaseUrl}/openapi.json`,
    x402: `${config.publicBaseUrl}/.well-known/x402`,
    x402Json: `${config.publicBaseUrl}/.well-known/x402.json`,
    agent: `${config.publicBaseUrl}/.well-known/agent.json`,
    agentServices: `${config.publicBaseUrl}/.well-known/agent-services.json`,
    aiPlugin: `${config.publicBaseUrl}/.well-known/ai-plugin.json`,
    mcp: `${config.publicBaseUrl}/.well-known/mcp.json`,
    mcpEndpoint: `${config.publicBaseUrl}/mcp`,
    mcpTools: `${config.publicBaseUrl}/api/mcp/tools`,
    directoryProfile: `${config.publicBaseUrl}/directory`,
    directoryProfileJson: `${config.publicBaseUrl}/directory.json`,
    radar: `${config.publicBaseUrl}/radar`,
    radarJson: `${config.publicBaseUrl}/radar.json`,
    radarDigest: `${config.publicBaseUrl}/api/radar/digest`,
    ecosystemPulse: `${config.publicBaseUrl}/api/radar/ecosystem-pulse`,
    ecosystem: `${config.publicBaseUrl}/ecosystem`,
    ecosystemTrends: `${config.publicBaseUrl}/api/ecosystem/trends`,
    apiDirectoryProfile: `${config.publicBaseUrl}/api/directories/profile`,
    llms: `${config.publicBaseUrl}/llms.txt`,
    robots: `${config.publicBaseUrl}/robots.txt`,
    sitemap: `${config.publicBaseUrl}/sitemap.xml`,
    resources: `${config.publicBaseUrl}/api/resources`,
    marketplaceBundle: `${config.publicBaseUrl}/api/marketplace/bundle`,
    indexingRoutes: `${config.publicBaseUrl}/api/indexing/routes`,
    bazaarReindexWindow: `${config.publicBaseUrl}/api/bazaar/reindex-window`,
    completionAudit: `${config.publicBaseUrl}/api/completion/audit`
  };
}

function endpointDiscoveryRecord(resource) {
  const routeRecord = indexingRoutes().records.find((record) => record.id === resource.id);
  return {
    id: resource.id,
    name: routeRecord?.name || resource.id,
    url: `${config.publicBaseUrl}${resource.path}`,
    resource: `${config.publicBaseUrl}${resource.path}`,
    path: resource.path,
    method: resource.method,
    type: "http",
    x402Version: 2,
    price_usd: resource.priceUsd,
    description: resource.purpose,
    keywords: routeRecord?.keywords || [],
    semanticQueries: routeRecord?.semanticQueries || [],
    mcpToolName: routeRecord?.mcpToolName || null,
    resourcePage: routeRecord?.pageUrl || null,
    category: categoryFor(resource),
    accepts: [paymentInfo(resource).protocols[0].x402],
    inputSchema: requestSchemaFor(resource.id),
    openapi: `${config.publicBaseUrl}/openapi.json`
  };
}

function categoryFor(resource) {
  if (resource.id.startsWith("procurement.")) return "procurement";
  if (resource.id.startsWith("monitor.")) return "monitoring";
  if (resource.id.startsWith("reports.")) return "diligence";
  if (resource.id.startsWith("seller.")) return "seller";
  return "trust";
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function textPath(summary, contentType) {
  return {
    get: {
      summary,
      tags: ["Trust402"],
      responses: {
        "200": {
          description: "Text response",
          content: {
            [contentType]: {
              schema: { type: "string" }
            }
          }
        }
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
          minItems: 1,
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
          minItems: 1,
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
        fetchRegistries: { type: "boolean", default: false },
        useSeedRegistry: { type: "boolean", default: true },
        registryUrls: {
          type: "array",
          maxItems: 5,
          items: { type: "string", format: "uri" }
        },
        allowedRegistryOrigins: {
          type: "array",
          maxItems: 10,
          items: { type: "string" }
        },
        registryCandidates: {
          type: "array",
          maxItems: 10,
          items: candidateResourceSchema()
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

  if (id === "registries.candidates") {
    return {
      type: "object",
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number", default: 0.25 },
        maxCandidates: { type: "integer", minimum: 1, maximum: 10, default: 10 },
        fetchRegistries: { type: "boolean", default: false },
        useSeedRegistry: { type: "boolean", default: true },
        registryUrls: {
          type: "array",
          maxItems: 5,
          items: { type: "string", format: "uri" }
        },
        allowedRegistryOrigins: {
          type: "array",
          maxItems: 10,
          items: { type: "string" }
        },
        registryCandidates: {
          type: "array",
          maxItems: 10,
          items: candidateResourceSchema()
        },
        candidates: {
          type: "array",
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

  if (id === "agentcash.mcp_observation") {
    return {
      type: "object",
      properties: {
        accounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              network: { type: "string" },
              address: { type: "string" },
              balance: { type: "number" }
            }
          }
        },
        settings: {
          type: "object",
          properties: {
            maxAmount: { type: "number" }
          }
        }
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

  if (id === "payments.buyer_preflight") {
    return {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["cdp-x402"], default: "cdp-x402" },
        probeCdp: { type: "boolean", default: false },
        cdpEvmAccountAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        cdpEvmAccountName: { type: "string" }
      }
    };
  }

  if (id === "proof402.preflight") {
    return {
      type: "object",
      properties: {
        subject: { type: "string" },
        label: { type: "string" },
        payload: {},
        result: {},
        resultHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
        approvedHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
        approvedHashes: {
          type: "array",
          items: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" }
        },
        quotedPriceUsd: { type: "number" },
        paymentQuote: {
          type: "object",
          properties: {
            amount: { type: "string" },
            maxAmountRequired: { type: "string" },
            assetDecimals: { type: "integer", default: 6 },
            network: { type: "string", default: "eip155:8453" },
            asset: { type: "string" },
            payTo: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" }
          }
        },
        metadata: { type: "object" },
        idempotencyKey: { type: "string" }
      },
      anyOf: [
        { required: ["payload"] },
        { required: ["result"] },
        { required: ["resultHash"] }
      ]
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
        paymentProvider: { type: "string", enum: ["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"] },
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

  if (id === "bazaar.reindex_window") {
    return {
      type: "object",
      properties: {
        baseUrl: { type: "string", format: "uri" },
        indexedResourceIds: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        },
        missingResourceIds: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        },
        routeIds: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } }
          ]
        },
        starterCapUsd: { type: "number", default: 0.05 },
        paymentProvider: { type: "string", enum: ["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"] },
        includeProof: { type: "boolean", default: false },
        proofReserveUsd: { type: "number", default: 0.005 },
        lastVerifiedBalanceUsd: { type: "number" },
        minimumReserveUsd: { type: "number", default: 0.5 }
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
        selectedDomainAvailable: { type: "boolean" },
        selectedDomainPriceUsd: { type: "number" },
        selectedDomainPeriodYears: { type: "number" },
        selectedDomainPurchaseUrl: { type: "string", format: "uri" },
        selectedDomainAvailabilityMessage: { type: "string" },
        availabilityCheckedAt: { type: "string", format: "date-time" },
        availabilitySource: { type: "string" },
        domainAvailability: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              name: { type: "string" },
              available: { type: "boolean" },
              price: { type: "number" },
              period: { type: "number" },
              purchaseUrl: { type: "string", format: "uri" }
            }
          }
        },
        vercelProjectName: { type: "string", default: "trust402" }
      }
    };
  }

  if (id === "domains.readiness_check") {
    return {
      type: "object",
      properties: {
        domain: { type: "string" },
        customDomain: { type: "string" },
        selectedDomain: { type: "string" },
        baseUrl: { type: "string", format: "uri" },
        expectedBaseUrl: { type: "string", format: "uri" },
        timeoutMs: { type: "integer", default: 6000 },
        skipDns: { type: "boolean", default: false }
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

  if (id === "deployments.github_actions_setup") {
    return {
      type: "object",
      properties: {
        baseUrl: { type: "string", format: "uri" },
        repo: { type: "string", default: "kfubtik/trust402" },
        workflowPath: { type: "string", default: ".github/workflows/vercel-production-deploy.yml" },
        workflowPresent: { type: "boolean", default: true },
        gitHead: { type: "string" },
        vercelProject: {
          type: "object",
          properties: {
            projectName: { type: "string", default: "trust402" },
            projectId: { type: "string" },
            orgId: { type: "string" }
          }
        }
      }
    };
  }

  if (id === "operator.action_pack") {
    return operatorPlanningSchema();
  }

  if (id === "operator.unblock_report") {
    return operatorPlanningSchema();
  }

  if (id === "operator.readiness") {
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
      paymentProvider: { type: "string", enum: ["agentcash-mcp", "cdp-x402", "x402-fetch", "external-adapter"] },
      includeProof: { type: "boolean", default: true },
      includeAutonomous: { type: "boolean", default: false },
      includeAutoRefill: { type: "boolean", default: false },
      includeRefillLive: { type: "boolean", default: false },
      liveSpentTodayUsd: { type: "number", default: 0 },
      selectedDomain: { type: "string" },
      candidateDomains: {
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } }
        ]
      },
      selectedDomainAvailable: { type: "boolean" },
      selectedDomainPriceUsd: { type: "number" },
      selectedDomainPeriodYears: { type: "number" },
      selectedDomainPurchaseUrl: { type: "string", format: "uri" },
      availabilityCheckedAt: { type: "string", format: "date-time" },
      availabilitySource: { type: "string" },
      domainAvailability: { type: "array", items: { type: "object", additionalProperties: true } }
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
      useSeedRegistry: true
    };
  }
  if (id === "registries.candidates") {
    return {
      goal: "Create a proof-backed receipt for a safe x402 procurement result.",
      budgetUsd: 0.02,
      maxCandidates: 3,
      useSeedRegistry: true
    };
  }
  if (id === "agentcash.refill_check") {
    return {
      mode: "dry-run",
      currentBalanceUsd: 0.42,
      amountRefilledTodayUsd: 0
    };
  }
  if (id === "agentcash.mcp_observation") {
    return {
      accounts: [
        {
          network: "base",
          address: "0x1111111111111111111111111111111111111111",
          balance: 1.283
        }
      ],
      settings: {
        maxAmount: 0.01
      }
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
  if (id === "payments.buyer_preflight") {
    return {
      provider: "cdp-x402",
      probeCdp: false,
      cdpEvmAccountName: "trust402-buyer"
    };
  }
  if (id === "proof402.preflight") {
    return {
      subject: "example diligence result",
      resultHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      approvedHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      paymentQuote: {
        amount: "5000",
        assetDecimals: 6,
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x0E525428d66C111672cE58B1bf649A6d167f36b1"
      },
      metadata: {
        agent: "trust402",
        taskId: "task_123"
      }
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
  if (id === "bazaar.reindex_window") {
    return {
      baseUrl: "https://trust402.aztecbeacon.uk",
      missingResourceIds: [
        "trust.score_resource",
        "trust.evaluate_origin",
        "seller.readiness",
        "procurement.plan",
        "procurement.quote",
        "monitor.snapshot",
        "monitor.badge",
        "reports.x402_diligence"
      ],
      paymentProvider: "cdp-x402",
      includeProof: false,
      starterCapUsd: 0.05
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
      selectedDomain: "trust402.org",
      candidateDomains: ["trust402.org", "trust402.dev", "trust402.xyz"],
      selectedDomainAvailable: true,
      selectedDomainPriceUsd: 8.99,
      selectedDomainPeriodYears: 1,
      selectedDomainPurchaseUrl: "https://vercel.com/domains/search?q=trust402.org",
      availabilitySource: "vercel-domain-check"
    };
  }
  if (id === "domains.readiness_check") {
    return {
      domain: "trust402.dev",
      expectedBaseUrl: "https://trust402.dev",
      timeoutMs: 6000
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
  if (id === "deployments.github_actions_setup") {
    return {
      baseUrl: "https://trust402.vercel.app",
      repo: "kfubtik/trust402",
      workflowPath: ".github/workflows/vercel-production-deploy.yml",
      workflowPresent: true,
      gitHead: "43b96cf",
      vercelProject: {
        projectName: "trust402",
        projectId: "prj_...",
        orgId: "team_..."
      }
    };
  }
  if (id === "operator.action_pack") {
    return {
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://approved.example/paid",
      candidatePriceUsd: 0.01,
      maxTotalUsd: 0.03,
      includeProof: true,
      selectedDomain: "trust402.dev",
      selectedDomainAvailable: true,
      selectedDomainPriceUsd: 9.99,
      selectedDomainPeriodYears: 1
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
  if (id === "operator.readiness") {
    return {
      baseUrl: "https://trust402.vercel.app",
      candidateEndpoint: "https://proof402.vercel.app/api/proof/notarize",
      candidatePriceUsd: 0.005,
      proofReserveUsd: 0.005,
      includeProof: true,
      paymentProvider: "cdp-x402"
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
