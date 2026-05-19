import { config } from "./config.js";
import { sha256Json } from "./hash.js";

const DEFAULT_BASE_URL = "https://trust402.vercel.app";
const DEFAULT_CANDIDATES = [
  "trust402.dev",
  "trust402.xyz",
  "trust402.org",
  "gettrust402.com",
  "trust402agent.com"
];

const FREE_HOST_SUFFIXES = [
  "vercel.app",
  "workers.dev",
  "ngrok-free.app",
  "ngrok.io",
  "trycloudflare.com",
  "netlify.app",
  "pages.dev",
  "fly.dev",
  "render.com"
];

export function domainActivationPack(input = {}, options = {}) {
  const cfg = options.config || config;
  const baseUrl = normalizeBaseUrl(input.baseUrl || cfg.publicBaseUrl || DEFAULT_BASE_URL);
  const currentHost = hostPolicy(baseUrl);
  const selectedDomain = normalizeDomain(input.selectedDomain || input.domain || "");
  const candidateDomains = uniqueDomains([
    selectedDomain,
    ...arrayOrDefault(input.candidateDomains, DEFAULT_CANDIDATES)
  ]);
  const candidates = candidateDomains.map((domain) => candidatePlan(domain));
  const selected = selectedDomain
    ? candidatePlan(selectedDomain)
    : candidates.find((candidate) => candidate.acceptedByPolicy) || null;
  const desiredBaseUrl = selected?.acceptedByPolicy ? `https://${selected.domain}` : "https://<custom-trust402-domain>";
  const blockers = blockersFor({ currentHost, selected, selectedDomain });
  const packCore = {
    baseUrl,
    currentHost,
    selected: selected ? {
      domain: selected.domain,
      acceptedByPolicy: selected.acceptedByPolicy
    } : null,
    desiredBaseUrl,
    blockers
  };
  const activationPackHash = sha256Json(packCore);

  return {
    ok: true,
    tool: "domains.activation_pack",
    generatedAt: new Date().toISOString(),
    status: blockers.length === 0 ? "ready-to-attach" : "blocked",
    activationPackHash,
    baseUrl,
    currentHost,
    selectedDomain: selected,
    candidateDomains: candidates,
    availability: {
      checked: false,
      reason: "Domain availability and price are intentionally not claimed by this API. Recheck through Vercel or registrar immediately before purchase."
    },
    vercelPlan: {
      projectName: input.vercelProjectName || "trust402",
      desiredBaseUrl,
      dashboardSteps: [
        "Open the Vercel project trust402.",
        "Add the selected custom domain under Domains.",
        "Complete DNS or Vercel nameserver setup until HTTPS is ready.",
        "Set production PUBLIC_BASE_URL to the custom HTTPS origin.",
        "Redeploy and verify production routes before any directory submission."
      ],
      envPlan: {
        PUBLIC_BASE_URL: desiredBaseUrl
      },
      mutationCommandsRequireOperatorApproval: [
        "npx vercel@latest domains add <custom-domain>",
        "npx vercel@latest env add PUBLIC_BASE_URL production",
        "npx vercel@latest --prod --yes"
      ],
      verifyCommands: [
        `npm run smoke -- ${desiredBaseUrl}`,
        `npm run smoke:x402 -- ${desiredBaseUrl}`,
        `npm run launch:monitor -- ${desiredBaseUrl} --timeout-ms=10000 --strict`,
        `npm run directories:check -- ${desiredBaseUrl} --timeout-ms=10000`,
        `npm run deployment:preflight -- ${desiredBaseUrl} --custom-domain=${selected?.domain || "<custom-domain>"} --probe-vercel-api`
      ]
    },
    directoryImpact: {
      unlocksFreeHostingBlockedTargets: !currentHost.ready && Boolean(selected?.acceptedByPolicy),
      currentlyBlockedByHost: !currentHost.ready,
      targetsKnownToRejectFreeHosting: ["x402-list.com"],
      nextAfterDomain: [
        "Regenerate /api/directories/submission-pack with the custom baseUrl.",
        "Submit public-safe listing copy only where manual outreach is approved.",
        "Record TRUST402_EXTERNAL_DIRECTORY_* evidence only after a public directory visibly lists Trust402."
      ]
    },
    evidenceEnv: {
      PUBLIC_BASE_URL: desiredBaseUrl,
      TRUST402_EXTERNAL_DIRECTORY_STATUS: "visible",
      TRUST402_EXTERNAL_DIRECTORY_EVIDENCE_URL: "<public listing URL where Trust402 is visible>",
      TRUST402_EXTERNAL_DIRECTORY_NAME: "<non-CDP directory name>"
    },
    blockers,
    safety: {
      readOnly: true,
      buysDomain: false,
      mutatesVercel: false,
      setsEnv: false,
      submitsDirectoryForms: false,
      sendsPaymentHeaders: false,
      includesSecrets: false
    },
    nextActions: blockers.length === 0
      ? [
          "Recheck selected domain availability and price.",
          "Attach the domain in Vercel or registrar after operator approval.",
          "Set PUBLIC_BASE_URL and rerun all verification commands.",
          "Submit directory listing only after custom-domain smoke passes."
        ]
      : blockers.map((blocker) => blocker.message)
  };
}

function candidatePlan(domain) {
  const normalized = normalizeDomain(domain);
  const valid = isValidDomain(normalized);
  const freeHostingSuffix = freeHostingSuffixFor(normalized);
  const acceptedByPolicy = valid && !freeHostingSuffix;
  return {
    domain: normalized,
    url: normalized ? `https://${normalized}` : "",
    valid,
    acceptedByPolicy,
    freeHostingSuffix,
    availabilityChecked: false,
    priceChecked: false,
    status: acceptedByPolicy
      ? "candidate-requires-availability-check"
      : valid
        ? "rejected-free-hosting"
        : "invalid-domain",
    reason: acceptedByPolicy
      ? "Domain shape is acceptable for external directories, but availability and price must be checked before purchase."
      : valid
        ? "Known free-hosting/dev-tunnel domains do not satisfy external directory requirements."
        : "Candidate must be a bare domain such as trust402.dev, not a URL or empty value."
  };
}

function blockersFor({ currentHost, selected, selectedDomain }) {
  const blockers = [];
  if (currentHost.ready) {
    return blockers;
  }
  if (!selectedDomain) {
    blockers.push({
      id: "selected_domain_not_confirmed",
      message: "Select a custom domain candidate and recheck availability before attachment."
    });
  }
  if (!selected?.valid) {
    blockers.push({
      id: "selected_domain_invalid",
      message: "Selected domain must be a valid bare domain, not a URL or free-form label."
    });
  } else if (!selected.acceptedByPolicy) {
    blockers.push({
      id: "selected_domain_not_accepted",
      message: "Selected domain is still on the free-hosting/dev-tunnel blocklist."
    });
  }
  return blockers;
}

function hostPolicy(baseUrl) {
  let host = "";
  try {
    host = new URL(baseUrl).host;
  } catch {
    return {
      baseUrl,
      host: "",
      ready: false,
      freeHostingSuffix: "invalid-url",
      reason: "Base URL is not valid."
    };
  }
  const freeHostingSuffix = freeHostingSuffixFor(host);
  return {
    baseUrl,
    host,
    ready: Boolean(host) && !freeHostingSuffix,
    freeHostingSuffix,
    reason: freeHostingSuffix
      ? "Current host is a known free-hosting/dev-tunnel domain and still blocks some external directories."
      : "Current host is not on the known free-hosting/dev-tunnel blocklist."
  };
}

function freeHostingSuffixFor(value) {
  const host = String(value || "").toLowerCase();
  return FREE_HOST_SUFFIXES.find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) || null;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^https?:\/\//.test(raw)) {
    try {
      return new URL(raw).host;
    } catch {
      return raw;
    }
  }
  return raw.replace(/^\/+|\/+$/g, "");
}

function isValidDomain(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);
}

function arrayOrDefault(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function uniqueDomains(values) {
  return Array.from(new Set(values.map(normalizeDomain).filter(Boolean)));
}
