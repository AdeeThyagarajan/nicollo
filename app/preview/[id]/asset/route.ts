// devassist/app/preview/[id]/route.ts
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import net from "net";

import { readMeta, writeMeta } from "@/lib/sandbox/meta";

export const runtime = "nodejs";

const processes = new Map<string, any>();

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Could not get free port")));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForPort(port: number, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.createConnection({ port, host: "127.0.0.1" }, () => {
        s.end();
        resolve(true);
      });
      s.on("error", () => resolve(false));
      s.setTimeout(800, () => {
        try { s.destroy(); } catch {}
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  // Don't throw hard — we'll still redirect and let the proxy return a helpful error.
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  // If already started, just go straight to the proxied app.
  const existing = readMeta(projectId);
  if (existing?.preview?.nextPort) {
    const url = new URL(req.url);
    const res = NextResponse.redirect(
      new URL(`/preview/${projectId}/next`, url),
      307
    );
    // Used by middleware to route /_next/* and /api/* to the correct preview.
    res.cookies.set("da_preview", projectId, { path: "/", sameSite: "lax" });
    return res;
  }

  const meta = existing || {};

  // Ensure sandbox dir exists (some projects may not have been initialized yet)
  const projectDir = path.join(process.cwd(), "sandbox", "projects", projectId, "current");
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  const port = await getFreePort();

  // Start next dev server (one per project)
  const child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
    detached: true,
  });

  processes.set(projectId, child);

  writeMeta(projectId, {
    ...meta,
    preview: {
      ...(meta.preview || {}),
      nextPort: port,
      nextStartedAt: Date.now(),
    },
  });

  // Give the server a moment to start so the first iframe load doesn't race.
  await waitForPort(port);

  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL(`/preview/${projectId}/next`, url), 307);
  // Used by middleware to route /_next/* and /api/* to the correct preview.
  res.cookies.set("da_preview", projectId, { path: "/", sameSite: "lax" });
  return res;
}
