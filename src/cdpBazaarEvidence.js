export function cdpBazaarEvidenceStatus(runtimeConfig) {
  const expected = positiveInt(runtimeConfig.cdpBazaarExpectedResources);
  const indexed = positiveInt(runtimeConfig.cdpBazaarIndexedResources);
  const missingResources = Array.isArray(runtimeConfig.cdpBazaarMissingResources)
    ? runtimeConfig.cdpBazaarMissingResources.filter(Boolean)
    : [];
  const status = runtimeConfig.cdpBazaarCheckStatus || "";
  const hasRouteSummary = expected > 0 && indexed >= expected && missingResources.length === 0;
  const verified = runtimeConfig.cdpBazaarAllResourcesIndexed === true &&
    Boolean(runtimeConfig.cdpBazaarEvidenceRef) &&
    status === "all-indexed" &&
    hasRouteSummary;

  return {
    verified,
    claimedAllResourcesIndexed: runtimeConfig.cdpBazaarAllResourcesIndexed === true,
    evidenceRef: runtimeConfig.cdpBazaarEvidenceRef || "",
    status,
    expected,
    indexed,
    missingResources,
    reason: verified
      ? "CDP Bazaar all-resource evidence includes current route-count proof."
      : "CDP Bazaar evidence must include all-indexed status, expected/indexed counts, zero missing resources, and a public-safe evidence ref."
  };
}

function positiveInt(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
