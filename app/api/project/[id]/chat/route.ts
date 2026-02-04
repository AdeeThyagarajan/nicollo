// app/api/project/[id]/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import crypto from "crypto";

import { appendChat, readChat } from "@/lib/sandbox/chatStore";
import { writeFiles, listFiles, readFilesSnapshot } from "@/lib/sandbox/fs";
import { generateFiles } from "@/lib/ai/generateFiles";
import { readMeta, writeMeta } from "@/lib/sandbox/meta";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type SandboxFile = { path: string; content: string };

function uid() {
  return crypto.randomUUID();
}

function safeTrim(s: any) {
  return typeof s === "string" ? s.trim() : "";
}

function sanitizeAssistantMessage(msg: any, fallback: string) {
  const t = typeof msg === "string" ? msg.trim() : "";
  if (!t) return fallback;

  const hasFence = t.includes("```");
  const hasFileHeader = /^---\s+.+\s+---/m.test(t);
  const codeyLines = (t.match(/^\s*(import\s+|export\s+|const\s+|function\s+|class\s+|<\w+|{\s*$)/gm) || [])
    .length;

  if (hasFence || hasFileHeader || codeyLines >= 3 || t.length > 900) return fallback;

  const withoutFences = t.replace(/```[\s\S]*?```/g, "").trim();
  return withoutFences || fallback;
}

/**
 * PLATFORM INFERENCE (no technical questions upfront)
 * - infer from first prompt
 * - if unclear, ask ONE simple question (then default to web if still unclear)
 */
function inferPlatform(
  text: string
): "web" | "ios" | "android" | "ios_android" | null {
  const t = (text || "").toLowerCase();

  const hasWeb =
    /\b(web|website|saas|dashboard|landing page|next\.?js|browser)\b/.test(t);
  const hasIOS = /\b(ios|iphone|ipad|apple)\b/.test(t);
  const hasAndroid = /\b(android)\b/.test(t);

  if (hasIOS && hasAndroid) return "ios_android";
  if (hasIOS) return "ios";
  if (hasAndroid) return "android";
  if (hasWeb) return "web";

  // If they say "app" but don’t specify platform, it’s unclear -> ask once.
  if (/\bapp\b/.test(t)) return null;

  return null;
}

function parsePlatformAnswer(
  text: string
): "web" | "ios" | "android" | "ios_android" | null {
  const t = (text || "").toLowerCase();
  if (/\b(both|ios and android|iphone and android|android and iphone)\b/.test(t))
    return "ios_android";
  if (/\b(web|website|browser|saas)\b/.test(t)) return "web";
  if (/\b(ios|iphone|ipad|apple)\b/.test(t)) return "ios";
  if (/\b(android)\b/.test(t)) return "android";
  return null;
}

/**
 * Default platform → language → framework rules (LOCKED)
 */
function buildInfoDefaults(platform: "web" | "ios" | "android" | "ios_android") {
  if (platform === "web") {
    return {
      platform,
      framework: "nextjs" as const,
      language: "javascript" as const,
    };
  }
  if (platform === "ios_android") {
    return {
      platform,
      framework: "shared_mobile" as const,
      language: "javascript" as const,
    };
  }
  if (platform === "ios") {
    return {
      platform,
      framework: "swift" as const,
      language: "swift" as const,
    };
  }
  return {
    platform,
    framework: "kotlin" as const,
    language: "kotlin" as const,
  };
}

function isImageRequest(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("mockup") ||
    t.includes("wireframe") ||
    t.includes("ui design") ||
    t.includes("ui mockup") ||
    t.includes("design image") ||
    t.includes("screen design") ||
    t.includes("dashboard ui") ||
    t.includes("create a ui") ||
    t.includes("ui image") ||
    t.includes("mock up") // IMPORTANT: catch "mock up" too
  );
}

function isBuildRequest(text: string) {
  const t = text.toLowerCase();

  // Explicit build verbs
  if (
    t.includes("build") ||
    t.includes("create an app") ||
    t.includes("create a project") ||
    t.includes("generate code") ||
    t.includes("write code") ||
    t.includes("set up") ||
    t.includes("implement") ||
    t.includes("update the app") ||
    t.includes("modify the app") ||
    t.includes("change the app")
  ) {
    return true;
  }

  // "Builder-ish" phrasing that users commonly use.
  if (t.includes("create a") || t.includes("add a") || t.includes("make this") || t.includes("app that")) {
    return true;
  }

  // If the user is clearly describing an app spec (platform/framework + requirements),
  // treat it as a build request even if they didn't say "build".
  // This fixes cases like: "It is an app for both android and iOS. use openweathermap..."
  const mentionsPlatformOrStack =
    /\b(it is|it's)\s+(an?\s+)?app\b/.test(t) ||
    /\b(ios|android|iphone|ipad|react\s*native|expo|next\.?js|web app|saas)\b/.test(t);

  const requirementHits = (t.match(/\b(use|support|include|should|must|need|with|add)\b/g) || []).length;
  const hasFileOrCodeSignals = /\b(readme|package\.json|app\.js|index\.html|src\/|\.env|endpoint|api key)\b/.test(t);

  if ((mentionsPlatformOrStack && requirementHits >= 2) || hasFileOrCodeSignals) return true;

  return false;
}

/**
 * Keep any file that has a path; allow empty content too (still creates a file).
 * This prevents "no files written" when the model returns an empty string for some files.
 */
function normalizeFiles(files: any): SandboxFile[] {
  if (!Array.isArray(files)) return [];
  const out: SandboxFile[] = [];

  for (const f of files) {
    if (!f) continue;
    const path = typeof f.path === "string" ? f.path.trim() : "";
    const content = typeof f.content === "string" ? f.content : "";
    if (!path) continue;

    // prevent weird absolute paths
    const safePath = path.replace(/^(\.\.\/)+/g, "").replace(/^\/+/, "");
    out.push({ path: safePath, content });
  }

  // de-dupe by path (last one wins)
  const byPath = new Map<string, SandboxFile>();
  for (const f of out) byPath.set(f.path, f);
  return Array.from(byPath.values());
}

/**
 * Hard guarantee: if the model returns no files, we still create a real scaffold.
 * This prevents the “toy/dummy” feel and guarantees the project folder is never empty.
 */
function fallbackScaffold(userPrompt: string): SandboxFile[] {
  return [
    {
      path: "README.md",
      content: `# Devassist Project

## Goal
${userPrompt}

## What you got
- A real file scaffold written into the project folder (even if some runtime features are limited in sandbox)
- A working local proxy example for real-time Places data (CORS-safe + hides API key)
- A simple frontend that calls the proxy

## Real-time restaurants (important)
Browser calls to Google Places Web Service endpoints often fail due to CORS and expose your API key.
Use the included proxy (\`server/proxy.js\`) and keep the key in \`.env\`.

## Run
1) Copy env:
   - cp .env.example .env
   - set GOOGLE_PLACES_API_KEY

2) Start proxy:
   - node server/proxy.js

3) Serve frontend locally:
   - python -m http.server 5173
   - open http://localhost:5173

`,
    },
    {
      path: ".env.example",
      content: `# DO NOT COMMIT REAL KEYS

GOOGLE_PLACES_API_KEY=YOUR_KEY_HERE
PORT=8787
`,
    },
    {
      path: "server/proxy.js",
      content: `/**
 * Minimal Node proxy for Google Places Web Service (avoids CORS + hides API key).
 * Run: node server/proxy.js
 * Frontend calls: http://localhost:8787/api/places/nearby?... and /api/places/details?placeId=...
 *
 * NOTE:
 * - Requires Node 18+ (global fetch)
 * - This is intentionally minimal; add rate limiting + caching for production.
 */
import http from "http";
import { URL } from "url";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY. Create a .env file from .env.example");
  process.exit(1);
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(obj));
}

function send(res, status, text) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (req.method !== "GET") return send(res, 405, "method not allowed");

  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/places/nearby") {
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const radius = url.searchParams.get("radius") || "1500";
    const keyword = url.searchParams.get("keyword") || "restaurant";

    if (!lat || !lng) return sendJson(res, 400, { error: "lat,lng required" });

    const upstream = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    // ✅ FIX: escape template vars inside THIS TypeScript template string
    upstream.searchParams.set("location", lat + "," + lng);
    upstream.searchParams.set("radius", radius);
    upstream.searchParams.set("keyword", keyword);
    upstream.searchParams.set("key", API_KEY);

    try {
      const r = await fetch(upstream.toString());
      const j = await r.json();
      return sendJson(res, 200, j);
    } catch (e) {
      return sendJson(res, 500, { error: "upstream fetch failed" });
    }
  }

  if (url.pathname === "/api/places/details") {
    const placeId = url.searchParams.get("placeId");
    if (!placeId) return sendJson(res, 400, { error: "placeId required" });

    const upstream = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    upstream.searchParams.set("place_id", placeId);
    upstream.searchParams.set("fields", "name,formatted_address,rating,opening_hours,website,formatted_phone_number,photos");
    upstream.searchParams.set("key", API_KEY);

    try {
      const r = await fetch(upstream.toString());
      const j = await r.json();
      return sendJson(res, 200, j);
    } catch (e) {
      return sendJson(res, 500, { error: "upstream fetch failed" });
    }
  }

  return send(res, 404, "not found");
});

server.listen(PORT, () => {
  console.log("Proxy listening on", PORT);
});
`,
    },
  ];
}

async function summarizeForMemory(history: Array<{ role: string; content: string }>) {
  try {
    const trimmed = history.slice(-40);
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Summarize the project conversation into a short, factual memory for future iterations. " +
            "Capture goals, chosen stack/platform, key decisions, and what has been built so far. " +
            "No fluff. Return plain text only.",
        },
        {
          role: "user",
          content: trimmed.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"),
        },
      ],
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

async function updateRollingMemory(projectId: string) {
  const meta = readMeta(projectId) || { id: projectId };
  const history = readChat(projectId, 120);
  const memory = await summarizeForMemory(history);

  try {
    if (memory) {
      const next = { ...meta, memory, updatedAt: new Date().toISOString() };
      writeMeta(projectId, next);
      return next;
    }
  } catch {
    // don’t break app if summarization fails
  }

  return meta;
}

function saveGeneratedImageToMeta(
  projectId: string,
  image: { url?: string; dataUrl?: string; prompt?: string }
) {
  const meta = readMeta(projectId) || { id: projectId };
  const images = Array.isArray((meta as any).images) ? (meta as any).images : [];

  const nextImage = {
    id: uid(),
    createdAt: new Date().toISOString(),
    prompt: image.prompt || "",
    ...(image.url ? { url: image.url } : {}),
    ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}),
  };

  const next = {
    ...meta,
    images: [nextImage, ...images].slice(0, 20),
    lastImage: nextImage,
    updatedAt: new Date().toISOString(),
  };

  writeMeta(projectId, next as any);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Return the most recent turns for hydration on reload.
    // chatStore items are expected to be: { role, content, imageUrl?, imageDataUrl? }
    const turns = readChat(projectId, 200).map((t: any) => ({
      role: t.role,
      content: t.content,
      ...(t.imageUrl ? { imageUrl: t.imageUrl } : {}),
      ...(t.imageDataUrl ? { imageDataUrl: t.imageDataUrl } : {}),
    }));

    return NextResponse.json({ ok: true, turns });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ? String(err.message) : "Failed to load chat",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const message =
      typeof body.message === "string" ? body.message : body.message?.text;

    if (!message || typeof message !== "string") {
      return NextResponse.json({
        ok: false,
        error: "Invalid message payload",
      });
    }

    const projectId = params.id;

    // Persist user message (this matches your working chatStore shape)
    appendChat(projectId, { role: "user", content: message });

    // ---- PLATFORM INFERENCE + BUILD INFO (one question max) ----
    const metaAtStart = readMeta(projectId) || { id: projectId };
    const pendingPrompt = safeTrim((metaAtStart as any).pendingPlatformPrompt);

    if (!(metaAtStart as any).buildInfo) {
      if (pendingPrompt) {
        // They are answering the one clarification question
        const p = parsePlatformAnswer(message);
        const resolved = p ?? "web"; // ask once; default to web if still unclear
        const d = buildInfoDefaults(resolved);

        const appName =
          safeTrim((metaAtStart as any).title) || `Project ${projectId}`;
        const oneLiner =
          safeTrim(pendingPrompt).slice(0, 140) || "App build in progress.";

        writeMeta(projectId, {
          ...metaAtStart,
          pendingPlatformPrompt: undefined,
          buildInfo: {
            ...d,
            appName,
            oneLiner,
            coreFeatures: [],
          },
        } as any);
      } else {
        const inferred = inferPlatform(message);
        if (!inferred) {
          const question =
            "Is this a web app, an iPhone app, an Android app, or both iPhone and Android?";
          writeMeta(
            projectId,
            { ...metaAtStart, pendingPlatformPrompt: message } as any
          );
          appendChat(projectId, { role: "assistant", content: question });
          return NextResponse.json({ ok: true, type: "text", reply: question });
        }

        const d = buildInfoDefaults(inferred);
        const appName =
          safeTrim((metaAtStart as any).title) || `Project ${projectId}`;
        const oneLiner =
          safeTrim(message).slice(0, 140) || "App build in progress.";

        writeMeta(projectId, {
          ...metaAtStart,
          buildInfo: {
            ...d,
            appName,
            oneLiner,
            coreFeatures: [],
          },
        } as any);
      }
    }

    /**
     * IMAGE MODE (FIXED)
     * - No unsupported params (no response_format)
     * - Returns url OR dataUrl
     * - DOES NOT store huge data URLs in chat history (prevents the UI printing base64 blobs)
     * - Stores images in meta.images / meta.lastImage instead
     */
    if (isImageRequest(message)) {
      try {
        const image = await openai.images.generate({
          model: "gpt-image-1",
          prompt: `
You are a senior product designer.

Create a high-fidelity, modern SaaS UI mockup based on this request:

${message}

Constraints:
- realistic product UI
- clean typography
- neutral background
- professional SaaS style
`,
          size: "1024x1024",
        } as any);

        const first = (image as any)?.data?.[0];
        const imageUrl = first?.url ? String(first.url) : "";
        const b64 = first?.b64_json ? String(first.b64_json) : "";

        const imageDataUrl = b64 ? `data:image/png;base64,${b64}` : "";

        if (!imageUrl && !imageDataUrl) {
          const errMsg = "Image generation returned no url or base64";
          appendChat(projectId, { role: "assistant", content: errMsg });
          return NextResponse.json({ ok: false, error: errMsg });
        }

        // Save the actual image payload in meta, NOT as a chat bubble string.
        saveGeneratedImageToMeta(projectId, {
          url: imageUrl || undefined,
          dataUrl: imageDataUrl || undefined,
          prompt: message,
        });

        // Chat bubble stays readable (no base64 dump)
        const friendly = "Mockup image generated.";
        appendChat(projectId, { role: "assistant", content: friendly });

        return NextResponse.json({
          ok: true,
          type: "image",
          reply: friendly, // IMPORTANT: keep this human, not the raw URL/base64
          ...(imageUrl ? { imageUrl } : {}),
          ...(!imageUrl && imageDataUrl ? { imageDataUrl } : {}),
        });
      } catch (err: any) {
        const msg = err?.message || "Image generation error";
        appendChat(projectId, { role: "assistant", content: msg });
        return NextResponse.json({ ok: false, error: msg });
      }
    }

    // BUILD MODE
    if (isBuildRequest(message)) {
      // keep memory updated so builds stack cleanly
      const metaBefore = await updateRollingMemory(projectId);
      const memory =
        typeof (metaBefore as any).memory === "string"
          ? (metaBefore as any).memory
          : "";

      const history = readChat(projectId, 80);

      // context shape kept as you had it (role + text)
      const context = history.map((m) => ({
        role: m.role,
        text: m.content,
      }));

      // ✅ Read the current project files from disk and feed them into the builder
      const existingPaths = listFiles(projectId).slice(0, 200); // cap to avoid huge prompts
      const existingFiles = readFilesSnapshot(projectId, existingPaths, 120_000);

      // Build Info passed into generator (source of truth)
      const metaForBuild = readMeta(projectId) || {};
      const buildInfo = (metaForBuild as any).buildInfo || null;

      const result = await generateFiles({
        userMessage: message,
        context,
        existingFiles,
        buildInfo,
        instructions: `
You MUST return a non-empty list of files to write to the project folder.
You MUST build on the CURRENT PROJECT FILES provided (do not reset unless explicitly asked).
If external services are needed (real-time restaurants, maps, auth, payments):
- still generate the full scaffold (frontend + backend/proxy + env template + README)
- do not refuse due to sandbox runtime limitations

Project memory (authoritative):
${memory || "(none)"}

Build Info (source of truth; MUST obey):
${buildInfo ? JSON.stringify(buildInfo, null, 2) : "(not set yet)"}
`,
      } as any);

      if (!result?.ok) {
        return NextResponse.json({
          ok: false,
          error: result?.reason || "Build failed",
        });
      }

      let files = normalizeFiles(result.files);

      // HARD GUARANTEE: never write zero files
      if (files.length === 0) {
        files = fallbackScaffold(message);
      }

      // Write files into sandbox (await is critical if writeFiles is async)
      await writeFiles(projectId, files);

      // ✅ Canonical file list from disk (not just this iteration)
      const diskFilePaths = listFiles(projectId);

      // Update meta:
      const meta = readMeta(projectId) || {};
      const bi = (meta as any).buildInfo;

      // Keep a rolling list of core features (iteration, not regeneration)
      const nextFeatures = (() => {
        if (!bi) return null;
        const existing = Array.isArray(bi.coreFeatures)
          ? (bi.coreFeatures as string[])
          : [];
        const suggestion = safeTrim(message).split("\n")[0].slice(0, 80);
        if (!suggestion) return existing.slice(0, 8);
        const merged = [suggestion, ...existing].filter(
          (v, i, arr) =>
            arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i
        );
        return merged.slice(0, 8);
      })();

      writeMeta(projectId, {
        ...meta,
        built: true,
        entry: "index.html",
        files: diskFilePaths,
        version:
          (typeof (meta as any).version === "number" ? (meta as any).version : 0) +
          1,
        lastBuildAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(bi && nextFeatures
          ? { buildInfo: { ...bi, coreFeatures: nextFeatures } }
          : {}),
      } as any);

      const assistantMessage = sanitizeAssistantMessage(
        (result as any).assistantMessage,
        `Built project and wrote ${files.length} file(s) to the project folder.`
      );

      appendChat(projectId, { role: "assistant", content: assistantMessage });

      return NextResponse.json({
        ok: true,
        type: "build",
        reply: assistantMessage,
        filesWritten: diskFilePaths,
      });
    }

    // CHAT MODE
    const metaNow = await updateRollingMemory(projectId);
    const memory =
      typeof (metaNow as any).memory === "string" ? (metaNow as any).memory : "";
    const metaForChat = readMeta(projectId) || {};
    const buildInfoForChat = (metaForChat as any).buildInfo || null;

    // Project awareness: provide the current file tree (paths only) as authoritative grounding.
    const projectFilePaths = listFiles(projectId).slice(0, 400);

    const history = readChat(projectId, 80);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are Devassist, the AI builder running inside THIS project. Answer questions using the project's Build Info, memory, and file tree. " +
            "Do NOT say you are ChatGPT or a general-purpose assistant. Be concise and practical. " +
            "Never change platform/language/framework/app name unless the user explicitly asks.",
        },
        {
          role: "system",
          content: `Project files (authoritative paths):\n${
            projectFilePaths.length
              ? projectFilePaths.map((p) => `- ${p}`).join("\n")
              : "(no files yet)"
          }`,
        },
        {
          role: "system",
          content: `Build Info (source of truth; MUST obey):\n${
            buildInfoForChat
              ? JSON.stringify(buildInfoForChat, null, 2)
              : "(not set yet)"
          }`,
        },
        ...(memory
          ? [
              {
                role: "system" as const,
                content: `Project memory (authoritative):\n${memory}`,
              },
            ]
          : []),
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const reply = completion.choices[0].message.content || "";

    appendChat(projectId, { role: "assistant", content: reply });

    return NextResponse.json({
      ok: true,
      type: "text",
      reply,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Chat error",
      },
      { status: 200 }
    );
  }
}
