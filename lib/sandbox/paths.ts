import path from "path";
import fs from "fs";

export function projectRoot(projectId: string) {
  return path.join(process.cwd(), "sandbox", "projects", projectId);
}
export function currentDir(projectId: string) {
  return path.join(projectRoot(projectId), "current");
}
export function versionsDir(projectId: string) {
  return path.join(projectRoot(projectId), "versions");
}
export function stagingDir(projectId: string) {
  return path.join(projectRoot(projectId), "staging");
}

export function templateDir(projectId: string) {
  return path.join(projectRoot(projectId), "template");
}

export function ensureDirs(projectId: string) {
  const root = projectRoot(projectId);
  const cur = currentDir(projectId);
  const vers = versionsDir(projectId);
  const staging = stagingDir(projectId);
  const tmpl = templateDir(projectId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(cur)) fs.mkdirSync(cur, { recursive: true });
  if (!fs.existsSync(tmpl)) fs.mkdirSync(tmpl, { recursive: true });
  if (!fs.existsSync(vers)) fs.mkdirSync(vers, { recursive: true });
  if (!fs.existsSync(staging)) fs.mkdirSync(staging, { recursive: true });
}
