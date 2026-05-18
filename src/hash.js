import { createHash } from "node:crypto";

export function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

export function sha256Json(value) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortValue(nested)])
    );
  }
  return value;
}
