import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(root, "marketplace", "resources.json");

export function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, "utf8"));
}

export function paidResourceByPath(path) {
  return loadCatalog().paidLaunchResources.find((resource) => resource.path === path);
}

export function absoluteUrl(path) {
  return `${config.publicBaseUrl}${path}`;
}

export function publicResources() {
  const catalog = loadCatalog();
  return {
    ...catalog,
    generatedAt: new Date().toISOString(),
    freeResources: catalog.freeResources.map((resource) => ({
      ...resource,
      url: absoluteUrl(resource.path)
    })),
    paidLaunchResources: catalog.paidLaunchResources.map((resource) => ({
      ...resource,
      url: absoluteUrl(resource.path)
    }))
  };
}
