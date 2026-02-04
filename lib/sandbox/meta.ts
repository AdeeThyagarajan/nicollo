// lib/sandbox/meta.ts
import fs from "fs";
import path from "path";

export type ProjectMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;

  title?: string;
  description?: string;

  entry?: string;
  fileList?: string[];
  lastBuildAt?: string;
  lastBuildOk?: boolean;

  initialized?: boolean;
  built?: boolean;
  version?: number;
  files?: string[];

  memory?: string;

  pendingPlatformPrompt?: string;

  buildInfo?: {
    platform: "web" | "ios" | "android" | "ios_android";
    framework: "nextjs" | "shared_mobile" | "swift" | "kotlin";
    language: "javascript" | "typescript" | "swift" | "kotlin";
    appName: string;
    oneLiner: string;
    coreFeatures: string[];
  };

  // ✅ Added: preview runtime info
  preview?: {
    nextPort?: number;
    nextStartedAt?: number;
  };
};

function projectsRoot() {
  return path.join(process.cwd(), "sandbox", "projects");
}

function projectDir(projectId: string) {
  return path.join(projectsRoot(), projectId);
}

function metaPath(projectId: string) {
  return path.join(projectDir(projectId), "meta.json");
}

function ensureProjectDir(projectId: string) {
  const dir = projectDir(projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

export function readMeta(projectId: string): ProjectMeta | null {
  try {
    const p = metaPath(projectId);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as ProjectMeta;
  } catch {
    return null;
  }
}

export function writeMeta(projectId: string, patch: Partial<ProjectMeta>): ProjectMeta {
  ensureProjectDir(projectId);

  const prev = readMeta(projectId);
  const base: ProjectMeta = prev ?? {
    id: projectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const next: ProjectMeta = {
    ...base,
    ...patch,
    id: projectId,
    updatedAt: nowIso(),
  };

  fs.writeFileSync(metaPath(projectId), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export const readProjectMeta = readMeta;
export const writeProjectMeta = writeMeta;
