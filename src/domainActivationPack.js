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
  const availability = availabilityProfile(input);
  const candidateDomains = uniqueDomains([
    selectedDomain,
    ...arrayOrDefault(input.candidateDomains, DEFAULT_CANDIDATES)
  ]);
  const candidates = candidateDomains.map((domain) => candidatePlan(domain, availability.byDomain));
  const selected = selectedDomain
    ? candidatePlan(selectedDomain, availability.byDomain)
    : candidates.find((candidate) => candidate.acceptedByPolicy) || null;
  const desiredBaseUrl = selected?.acceptedByPolicy ? `https://${selected.domain}` : "https://<custom-trust402-domain>";
  const blockers = blockersFor({ currentHost, selected, selectedDomain });
  const packCore = {
    baseUrl,
    currentHost,
    selected: selected ? candidateEvidenceSubject(selected) : null,
    candidateDomains: candidates.map(candidateEvidenceSubject),
    availability: availability.summary,
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
    availability: availability.summary,
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
      ? nextActionsForAvailability(selected, availability.summary)
      : blockers.map((blocker) => blocker.message)
  };
}

function nextActionsForAvailability(selected, availability) {
  if (selected?.availabilityChecked && selected.available === true) {
    return [
      "Purchase or attach the selected domain after operator approval.",
      "Set PUBLIC_BASE_URL and rerun all verification commands.",
      "Submit directory listing only after custom-domain smoke passes."
    ];
  }
  if (availability.checked) {
    return [
      "Select a domain that is currently available and accepted by policy.",
      "Attach the domain in Vercel or registrar after operator approval.",
      "Set PUBLIC_BASE_URL and rerun all verification commands.",
      "Submit directory listing only after custom-domain smoke passes."
    ];
  }
  return [
    "Recheck selected domain availability and price.",
    "Attach the domain in Vercel or registrar after operator approval.",
    "Set PUBLIC_BASE_URL and rerun all verification commands.",
    "Submit directory listing only after custom-domain smoke passes."
  ];
}

function candidatePlan(domain, availabilityByDomain = new Map()) {
  const normalized = normalizeDomain(domain);
  const valid = isValidDomain(normalized);
  const freeHostingSuffix = freeHostingSuffixFor(normalized);
  const acceptedByPolicy = valid && !freeHostingSuffix;
  const availability = availabilityByDomain.get(normalized) || null;
  const availabilityChecked = Boolean(availability);
  const priceChecked = availabilityChecked && availability.priceUsd !== null;
  const available = availabilityChecked ? availability.available === true : null;
  const status = candidateStatus({ acceptedByPolicy, valid, availabilityChecked, available });
  return {
    domain: normalized,
    url: normalized ? `https://${normalized}` : "",
    valid,
    acceptedByPolicy,
    freeHostingSuffix,
    availabilityChecked,
    priceChecked,
    available,
    priceUsd: availability?.priceUsd ?? null,
    periodYears: availability?.periodYears ?? null,
    purchaseUrl: availability?.purchaseUrl || null,
    registrarMessage: availability?.message || null,
    checkedAt: availability?.checkedAt || null,
    status,
    reason: candidateReason({ acceptedByPolicy, valid, availabilityChecked, available })
  };
}

function candidateEvidenceSubject(candidate) {
  return {
    domain: candidate.domain,
    valid: candidate.valid,
    acceptedByPolicy: candidate.acceptedByPolicy,
    availabilityChecked: candidate.availabilityChecked,
    priceChecked: candidate.priceChecked,
    available: candidate.available,
    priceUsd: candidate.priceUsd,
    periodYears: candidate.periodYears,
    purchaseUrl: candidate.purchaseUrl,
    checkedAt: candidate.checkedAt,
    status: candidate.status
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
  } else if (selected.availabilityChecked && selected.available !== true) {
    blockers.push({
      id: "selected_domain_unavailable",
      message: "Selected domain was checked and is not currently available."
    });
  }
  return blockers;
}

function candidateStatus({ acceptedByPolicy, valid, availabilityChecked, available }) {
  if (!valid) return "invalid-domain";
  if (!acceptedByPolicy) return "rejected-free-hosting";
  if (!availabilityChecked) return "candidate-requires-availability-check";
  if (available) return "available-to-purchase";
  return "unavailable";
}

function candidateReason({ acceptedByPolicy, valid, availabilityChecked, available }) {
  if (!valid) return "Candidate must be a bare domain such as trust402.dev, not a URL or empty value.";
  if (!acceptedByPolicy) return "Known free-hosting/dev-tunnel domains do not satisfy external directory requirements.";
  if (!availabilityChecked) return "Domain shape is acceptable for external directories, but availability and price must be checked before purchase.";
  if (available) return "Domain is currently reported available and accepted by external-directory policy; purchase still requires operator approval.";
  return "Domain is accepted by policy but is not currently available according to the provided registrar check.";
}

function availabilityProfile(input) {
  const entries = availabilityEntries(input);
  const byDomain = new Map();
  for (const entry of entries) {
    const normalized = normalizeAvailabilityEntry(entry, input.availabilityCheckedAt);
    if (normalized?.domain) byDomain.set(normalized.domain, normalized);
  }
  const values = Array.from(byDomain.values());
  const availableValues = values.filter((item) => item.available === true);
  const totalPriceUsd = roundUsd(availableValues.reduce((sum, item) => sum + (item.priceUsd || 0), 0));
  return {
    byDomain,
    summary: values.length > 0
      ? {
          checked: true,
          checkedAt: input.availabilityCheckedAt || null,
          source: input.availabilitySource || "operator-provided",
          checkedDomains: values.length,
          available: availableValues.length,
          unavailable: values.length - availableValues.length,
          totalAvailablePriceUsd: totalPriceUsd,
          reason: "Availability and price were provided as public-safe operator evidence. Recheck immediately before purchase."
        }
      : {
          checked: false,
          reason: "Domain availability and price are intentionally not claimed by this API. Recheck through Vercel or registrar immediately before purchase."
        }
  };
}

function availabilityEntries(input) {
  if (Array.isArray(input.domainAvailability)) return input.domainAvailability;
  if (Array.isArray(input.availabilityResults)) return input.availabilityResults;
  if (input.selectedDomainAvailable !== undefined || input.selectedDomainPriceUsd !== undefined) {
    const domain = normalizeDomain(input.selectedDomain || input.domain || "");
    if (!domain) return [];
    return [{
      name: domain,
      available: input.selectedDomainAvailable,
      price: input.selectedDomainPriceUsd,
      period: input.selectedDomainPeriodYears,
      purchaseUrl: input.selectedDomainPurchaseUrl,
      message: input.selectedDomainAvailabilityMessage
    }];
  }
  return [];
}

function normalizeAvailabilityEntry(entry, checkedAt) {
  if (!entry || typeof entry !== "object") return null;
  const domain = normalizeDomain(entry.name || entry.domain || entry.id || "");
  if (!domain) return null;
  return {
    domain,
    available: parseBoolean(entry.available),
    priceUsd: parseNullableNumber(entry.priceUsd ?? entry.price),
    periodYears: parseNullableNumber(entry.periodYears ?? entry.period),
    purchaseUrl: typeof entry.purchaseUrl === "string" ? entry.purchaseUrl : null,
    message: typeof entry.message === "string" ? entry.message : null,
    checkedAt: entry.checkedAt || checkedAt || null
  };
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

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1", "available"].includes(normalized)) return true;
    if (["false", "no", "0", "unavailable"].includes(normalized)) return false;
  }
  return Boolean(value);
}

function parseNullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
