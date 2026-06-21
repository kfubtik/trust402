import { loadCatalog } from "./catalog.js";
import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { sha256Json } from "./hash.js";

const TOOL_DEFINITIONS = [
  {
    name: "score_x402_resource",
    title: "Score x402 resource",
    resourceId: "trust.score_resource",
    description:
      "Prepare a paid Trust402 request that scores one x402 resource for trust, schema, price, discovery, and receipt readiness.",
    inputSchema: {
      type: "object",
      required: ["endpoint"],
      properties: {
        endpoint: { type: "string", format: "uri" },
        priceUsd: { type: "number" },
        has402: { type: "boolean" },
        hasInputSchema: { type: "boolean" },
        hasOpenApi: { type: "boolean" },
        hasWellKnown: { type: "boolean" },
        receiptReady: { type: "boolean" },
        description: { type: "string" }
      }
    }
  },
  {
    name: "compare_x402_resources",
    title: "Compare x402 resources",
    resourceId: "trust.compare_resources",
    description:
      "Prepare a paid Trust402 request that ranks 2-10 candidate x402 resources for a goal, budget, and risk policy.",
    inputSchema: {
      type: "object",
      required: ["candidates"],
      properties: {
        goal: { type: "string" },
        budgetUsd: { type: "number" },
        candidates: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            required: ["endpoint"],
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              endpoint: { type: "string", format: "uri" },
              priceUsd: { type: "number" },
              hasInputSchema: { type: "boolean" },
              hasOpenApi: { type: "boolean" },
              hasWellKnown: { type: "boolean" },
              receiptReady: { type: "boolean" }
            }
          }
        }
      }
    }
  },
  {
    name: "prepare_x402_purchase",
    title: "Prepare x402 purchase",
    resourceId: "procurement.quote",
    description:
      "Prepare a paid Trust402 request that returns a bounded quote and approval payload before a buyer agent purchases x402 resources.",
    inputSchema: {
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
          items: {
            type: "object",
            required: ["endpoint"],
            additionalProperties: true,
            properties: {
              id: { type: "string" },
              endpoint: { type: "string", format: "uri" },
              priceUsd: { type: "number" },
              receiptReady: { type: "boolean" }
            }
          }
        }
      }
    }
  }
];

export function mcpTools(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || config.publicBaseUrl);
  return TOOL_DEFINITIONS.map((definition) => {
    const resource = resourceById(definition.resourceId);
    return {
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: {
        title: definition.title,
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      },
      x402: {
        paid: true,
        resourceId: definition.resourceId,
        method: resource.method,
        path: resource.path,
        url: `${baseUrl}${resource.path}`,
        maxAmountUsd: maxAmountUsd(resource.priceUsd),
        network: config.x402Network,
        asset: config.x402Asset
      }
    };
  });
}

export function mcpServerManifest(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || config.publicBaseUrl);
  return {
    schemaVersion: "trust402.mcp_manifest.v1",
    protocol: "mcp",
    transport: "streamable-http-jsonrpc",
    url: `${baseUrl}/mcp`,
    name: "Trust402 MCP Wrapper",
    description:
      "MCP wrapper for Trust402 paid x402 resources. Tools prepare paid x402 request packages for Base MCP, Hermes, Codex, and other buyer agents.",
    tools: mcpTools({ baseUrl }),
    instructions: [
      "Call tools/list to discover wrappers.",
      "Call tools/call to prepare a paid x402 request package.",
      "Use Base MCP initiate_x402_request and complete_x402_request, AgentCash fetch, or another x402 buyer to pay the returned paidEndpoint.",
      "Do not expect free execution of paid Trust402 resources through MCP."
    ],
    safety: {
      includesSecrets: false,
      sendsPaymentHeaders: false,
      paidSubcallsMadeByDiscovery: 0,
      bypassesX402Payment: false
    }
  };
}

export function mcpToolsCatalog(options = {}) {
  return {
    ok: true,
    tool: "mcp.tools_catalog",
    generatedAt: new Date().toISOString(),
    ...mcpServerManifest(options)
  };
}

export function mcpPaidRequest(toolName, args = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl || config.publicBaseUrl);
  const definition = TOOL_DEFINITIONS.find((item) => item.name === toolName);
  if (!definition) {
    throw new ApiError(404, "mcp_tool_not_found", "Unknown Trust402 MCP wrapper tool.", { toolName });
  }
  const resource = resourceById(definition.resourceId);
  const body = normalizeToolArguments(toolName, args);
  const request = {
    toolName,
    resourceId: definition.resourceId,
    method: resource.method,
    paidEndpoint: `${baseUrl}${resource.path}`,
    maxAmountUsd: maxAmountUsd(resource.priceUsd),
    body,
    bodyHash: sha256Json(body),
    payment: {
      protocol: "x402",
      network: config.x402Network,
      asset: config.x402Asset,
      payTo: config.payTo
    }
  };
  return {
    ok: true,
    tool: "mcp.paid_request",
    generatedAt: new Date().toISOString(),
    request,
    baseMcpWorkflow: [
      {
        tool: "initiate_x402_request",
        input: {
          url: request.paidEndpoint,
          method: request.method,
          maxPayment: request.maxAmountUsd,
          body: request.body,
          headers: { "content-type": "application/json" }
        }
      },
      {
        tool: "complete_x402_request",
        input: {
          requestId: "<requestId returned by initiate_x402_request>"
        }
      }
    ],
    agentcashWorkflow: {
      command:
        `npx agentcash fetch ${request.paidEndpoint} -m ${request.method} -H "content-type: application/json" -b '<json-body>' --payment-protocol x402 --payment-network base --max-amount ${request.maxAmountUsd}`
    },
    safety: {
      publicSafe: true,
      includesSecrets: false,
      sendsPaymentHeaders: false,
      paidSubcallsMadeByThisEndpoint: 0,
      bypassesX402Payment: false
    }
  };
}

export async function handleMcpJsonRpc(message) {
  const id = message?.id ?? null;
  try {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      throw new ApiError(400, "invalid_mcp_jsonrpc", "MCP requests must be JSON-RPC 2.0 objects.", {});
    }
    if (message.method === "initialize") {
      return jsonRpcResult(id, {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: { listChanged: false }
        },
        serverInfo: {
          name: "trust402",
          version: config.version
        },
        instructions: "Use tools/list, then tools/call. Trust402 MCP tools prepare paid x402 request packages."
      });
    }
    if (message.method === "tools/list") {
      return jsonRpcResult(id, { tools: mcpTools() });
    }
    if (message.method === "tools/call") {
      const params = message.params || {};
      const result = mcpPaidRequest(params.name, params.arguments || {});
      return jsonRpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        structuredContent: result,
        isError: false
      });
    }
    if (message.method === "ping") {
      return jsonRpcResult(id, {});
    }
    throw new ApiError(404, "mcp_method_not_found", "Unsupported Trust402 MCP method.", { method: message.method });
  } catch (error) {
    return jsonRpcError(id, error);
  }
}

function normalizeToolArguments(toolName, args) {
  if (toolName === "score_x402_resource") {
    if (!args.endpoint) {
      throw new ApiError(400, "invalid_mcp_tool_arguments", "endpoint is required.", { toolName });
    }
    return args;
  }
  if (toolName === "compare_x402_resources") {
    if (!Array.isArray(args.candidates) || args.candidates.length < 2) {
      throw new ApiError(400, "invalid_mcp_tool_arguments", "candidates must contain at least two resources.", { toolName });
    }
    return {
      goal: args.goal || "Compare x402 resources before purchase.",
      budgetUsd: args.budgetUsd,
      candidates: args.candidates
    };
  }
  if (toolName === "prepare_x402_purchase") {
    if (!args.goal || !(args.budgetUsd > 0)) {
      throw new ApiError(400, "invalid_mcp_tool_arguments", "goal and budgetUsd are required.", { toolName });
    }
    return args;
  }
  return args;
}

function resourceById(id) {
  const resource = loadCatalog().paidLaunchResources.find((item) => item.id === id);
  if (!resource) throw new ApiError(500, "mcp_resource_missing", "MCP wrapper references a missing paid resource.", { id });
  return resource;
}

function maxAmountUsd(priceUsd) {
  if (typeof priceUsd === "object" && priceUsd) return Number(priceUsd.max);
  return Number(priceUsd);
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, error) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : "internal_error";
  const message = error instanceof ApiError ? error.message : "Unexpected MCP error.";
  const details = error instanceof ApiError ? error.details : {};
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: status === 404 ? -32601 : status === 400 ? -32602 : -32603,
      message,
      data: { code, details }
    }
  };
}

function normalizeBaseUrl(value) {
  return String(value || "https://trust402.aztecbeacon.uk").replace(/\/+$/, "");
}
