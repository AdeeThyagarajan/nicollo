// lib/sandbox/fs.ts
import fs from "fs";
import path from "path";
import { currentDir, ensureDirs } from "@/lib/sandbox/paths";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "dist",
  "build",
  ".cache",
]);


export type FileWrite = {
  path: string; // relative path, e.g. "index.html" or "src/app.js"
  content: string; // full file contents
};

function safeResolve(base: string, target: string) {
  // Prevent weird absolute paths / traversal
  const clean = String(target || "").replace(/^([/\\])+/, "");
  const resolved = path.resolve(base, clean);
  if (!resolved.startsWith(base)) {
    throw new Error(`Invalid file path escape attempt: ${target}`);
  }
  return resolved;
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;

  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORE_DIRS.has(ent.name)) continue;
        walk(full);
      } else {
        out.push(path.relative(root, full));
      }
    }
  };

  walk(root);
  return out;
}

/**
 * Writes file contents into the project sandbox folder.
 * - Creates folders as needed
 * - Overwrites existing files
 */
export async function writeFiles(projectId: string, files: FileWrite[]) {
  if (!Array.isArray(files)) {
    throw new Error("writeFiles expects an array of files");
  }

  ensureDirs(projectId);
  const root = currentDir(projectId);
  fs.mkdirSync(root, { recursive: true });

  for (const f of files) {
    if (!f || typeof f.path !== "string" || typeof f.content !== "string") {
      throw new Error("Invalid file entry (expected { path: string, content: string })");
    }

    const abs = safeResolve(root, f.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content, "utf8");
  }
}

/**
 * Lists all files currently present in the project's sandbox folder.
 */
export function listFiles(projectId: string): string[] {
  const root = currentDir(projectId);
  return walkFiles(root).sort();
}

export function readFile(projectId: string, relPath: string): string | null {
  const root = currentDir(projectId);
  const abs = safeResolve(root, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

/**
 * Reads a (path -> content) snapshot for the given list of paths.
 * Useful to feed the builder so it can iterate on existing code.
 */
export function readFilesSnapshot(
  projectId: string,
  paths: string[],
  maxCharsPerFile = 200_000
): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  for (const p of paths) {
    const c = readFile(projectId, p);
    if (typeof c === "string") {
      out.push({ path: p, content: c.slice(0, maxCharsPerFile) });
    }
  }
  return out;
}
