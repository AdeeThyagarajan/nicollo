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

function projectDir(projectId: string) {
  return path.join(projectsRoot, String(projectId));
}

function generateProjectId() {
  // stable + filesystem safe
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

/**
 * Export used by /app/api/projects/route.ts
 * Creates a new project directory + meta.
 */
export function createProject(input?: { title?: string; id?: string }) {
  ensureDirs();

  const id = (input?.id && String(input.id).trim()) || generateProjectId();
  const dir = projectDir(id);

  if (fs.existsSync(dir)) {
    throw new Error("A project with that id already exists");
  }

  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();

  const meta: ProjectMeta = {
    id,
    title: (input?.title && String(input.title)) || `Project ${id}`,
    updatedAt: now,
    files: [],
    version: 0,
    built: false,
    initialized: true,
  };

  writeMeta(id, meta);

  return getProject(id);
}

/**
 * Export used by /app/api/projects/[id]/route.ts
 * Returns a stable project payload (meta + convenience fields).
 */
export function getProject(projectId: string) {
  const meta = getProjectMeta(projectId);

  return {
    id: meta.id,
    title: meta.title ?? `Project ${meta.id}`,
    updatedAt: meta.updatedAt,
    built: Boolean(meta.built),
    meta,
  };
}

/**
 * Export used by /app/api/projects/[id]/route.ts
 * Renames a project directory and updates meta.id + meta.title.
 */
export function renameProject(projectId: string, nextId: string) {
  ensureDirs();

  const fromId = String(projectId).trim();
  const toId = String(nextId).trim();

  if (!fromId || !toId) {
    throw new Error("Invalid project id");
  }
  if (fromId === toId) {
    return getProject(toId);
  }

  const fromPath = projectDir(fromId);
  const toPath = projectDir(toId);

  if (!fs.existsSync(fromPath) || !isDir(fromPath)) {
    throw new Error("Project not found");
  }
  if (fs.existsSync(toPath)) {
    throw new Error("A project with that id already exists");
  }

  fs.renameSync(fromPath, toPath);

  // Update meta under the new id
  const meta = (readMeta(toId) ?? { id: toId }) as ProjectMeta;

  writeMeta(toId, {
    ...meta,
    id: toId,
    title: meta.title ?? `Project ${toId}`,
    updatedAt: new Date().toISOString(),
  });

  return getProject(toId);
}

/**
 * Export used by /app/api/projects/[id]/route.ts
 * Deletes a project directory recursively.
 */
export function deleteProject(projectId: string) {
  ensureDirs();

  const id = String(projectId).trim();
  const dir = projectDir(id);

  if (!fs.existsSync(dir) || !isDir(dir)) {
    throw new Error("Project not found");
  }

  fs.rmSync(dir, { recursive: true, force: true });

  return { ok: true, id };
}
