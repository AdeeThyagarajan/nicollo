// lib/sandbox/paths.ts
import fs from "fs";
import path from "path";

/**
 * Vercel/serverless file writes must go to /tmp (writable).
 * Local dev can also use /tmp, but keeping it deterministic helps.
 */
const BASE = "/tmp";

export const sandboxRoot = path.join(BASE, "sandbox");
export const projectsRoot = path.join(sandboxRoot, "projects");

/**
 * Ensure base folders exist.
 * Accepts optional projectId for backward compatibility with older callers.
 */
export function ensureDirs(_projectId?: string) {
  fs.mkdirSync(projectsRoot, { recursive: true });
}

/** Absolute path to a project folder */
export function projectRoot(projectId: string) {
  return path.join(projectsRoot, String(projectId));
}

/** Ensure a given project's folder exists */
export function ensureProjectDir(projectId: string) {
  ensureDirs();
  fs.mkdirSync(projectRoot(projectId), { recursive: true });
}
