// lib/sandbox/projects.ts
import fs from "fs";
import path from "path";
import { ensureDirs, projectsRoot } from "@/lib/sandbox/paths";
import { readMeta, writeMeta, type ProjectMeta } from "@/lib/sandbox/meta";

export type ProjectSummary = {
  id: string;
  title: string;
  updatedAt?: string;
  built?: boolean;
};

function isDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function listProjects(): ProjectSummary[] {
  ensureDirs();

  const ids = fs
    .readdirSync(projectsRoot)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => isDir(path.join(projectsRoot, name)));

  const summaries: ProjectSummary[] = ids.map((id) => {
    const meta = readMeta(id);

    return {
      id,
      title: (meta?.title && String(meta.title)) || `Project ${id}`,
      updatedAt: meta?.updatedAt,
      built: Boolean(meta?.built),
    };
  });

  // newest first
  summaries.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });

  return summaries;
}

export function getProjectMeta(projectId: string): ProjectMeta {
  const meta = readMeta(projectId);
  if (meta) return meta;

  // Create a minimal meta if missing — must match ProjectMeta exactly
  const fresh: ProjectMeta = {
    id: String(projectId),
    title: `Project ${projectId}`,
    updatedAt: new Date().toISOString(),
    files: [],
    version: 0,
    built: false,
  };

  writeMeta(projectId, fresh);
  return fresh;
}
