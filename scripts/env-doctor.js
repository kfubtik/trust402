#!/usr/bin/env node
import { localEnvDiagnostics } from "../src/envDiagnostics.js";

console.log(JSON.stringify(localEnvDiagnostics(), null, 2));
