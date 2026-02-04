import "server-only";

import fs from "fs";
import path from "path";

import { ensureDirs, projectRoot } from "@/lib/sandbox/paths";
import { readMeta, writeMeta, type ProjectMeta } from "@/lib/sandbox/meta";

export type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function projectsRoot() {
  return path.join(process.cwd(), "sandbox", "projects");
}

function safeTitle(meta: ProjectMeta | null, fallback: string) {
  const t = meta?.title;
  if (typeof t === "string" && t.trim()) return t.trim();
  return fallback;
}

function statusFromMeta(meta: ProjectMeta | null) {
  // V1: keep it simple for the Projects list
  if (!meta) return "Stable";
  if (meta.lastBuildOk === false) return "Stable";
  return "Stable";
}

function readDirIds(): string[] {
  const root = projectsRoot();
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

function nextNumericId(existing: string[]) {
  const nums = existing
    .map((id) => {
      const n = Number(id);
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const max = nums.length ? nums[nums.length - 1] : 0;
  return String(max + 1);
}

export function listProjects(): ProjectSummary[] {
  const ids = readDirIds();

  const projects = ids
    .map((id) => {
      const meta = readMeta(id);
      const ensured = meta ?? writeMeta(id, { title: `Project ${id}` });
      return {
        id,
        title: safeTitle(ensured, `Project ${id}`),
        status: statusFromMeta(ensured),
        createdAt: ensured.createdAt,
        updatedAt: ensured.updatedAt,
      } satisfies ProjectSummary;
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return projects;
}

export function getProject(projectId: string): ProjectSummary | null {
  if (!projectId) return null;
  const meta = readMeta(projectId);
  if (!meta) return null;

  return {
    id: projectId,
    title: safeTitle(meta, `Project ${projectId}`),
    status: statusFromMeta(meta),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export async function createProject(opts?: {
  title?: string;
  description?: string;
}): Promise<ProjectSummary> {
  const ids = readDirIds();
  const id = nextNumericId(ids);

  // Create empty project structure so workspace opens blank but valid
  ensureDirs(id);

  const meta = writeMeta(id, {
    title: (opts?.title || "").trim() || `Project ${id}`,
    description: (opts?.description || "").trim() || undefined,
  });

  return {
    id,
    title: safeTitle(meta, `Project ${id}`),
    status: statusFromMeta(meta),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export function renameProject(projectId: string, title: string): ProjectSummary {
  const t = (title || "").trim();
  if (!t) throw new Error("Project title is required");

  ensureDirs(projectId);
  const meta = writeMeta(projectId, { title: t });

  return {
    id: projectId,
    title: safeTitle(meta, `Project ${projectId}`),
    status: statusFromMeta(meta),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export function deleteProject(projectId: string) {
  if (!projectId) return;
  const dir = projectRoot(projectId);
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}
