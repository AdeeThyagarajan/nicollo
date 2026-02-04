// lib/sandbox/meta.ts
import fs from "fs";
import path from "path";
import { getSandboxRoot } from "./fs";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function metaPath(projectId: string) {
  return path.join(getSandboxRoot(), "projects", projectId, "meta.json");
}

export function readMeta(projectId: string): any {
  const p = metaPath(projectId);
  if (!fs.existsSync(p)) return null;

  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeMeta(projectId: string, meta: any) {
  const p = metaPath(projectId);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(meta ?? {}, null, 2), "utf8");
}
