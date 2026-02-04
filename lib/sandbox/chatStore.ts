import "server-only";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/sandbox/paths";

export type ChatTurn = { role: "user" | "assistant"; content: string; at?: string };

function chatFile(projectId: string) {
  return path.join(projectRoot(projectId), "chat.json");
}

// Read chat history for a project. Keep it short so prompts stay stable.
export function readChat(projectId: string, limit = 24): Array<{ role: string; content: string }> {
  try {
    const fp = chatFile(projectId);
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = JSON.parse(raw) as ChatTurn[];
    if (!Array.isArray(parsed)) return [];
    const clipped = parsed.slice(-limit).map((t) => ({
      role: t.role,
      content: String(t.content || "").slice(0, 2000),
    }));
    return clipped;
  } catch {
    return [];
  }
}

export function appendChat(projectId: string, turn: ChatTurn) {
  try {
    const fp = chatFile(projectId);
    fs.mkdirSync(path.dirname(fp), { recursive: true });

    const existing: ChatTurn[] = (() => {
      try {
        if (!fs.existsSync(fp)) return [];
        const raw = fs.readFileSync(fp, "utf8");
        const j = JSON.parse(raw);
        return Array.isArray(j) ? (j as ChatTurn[]) : [];
      } catch {
        return [];
      }
    })();

    existing.push({ ...turn, at: new Date().toISOString() });

    // Hard cap
    const capped = existing.slice(-80);

    fs.writeFileSync(fp, JSON.stringify(capped, null, 2), "utf8");
  } catch {
    // ignore
  }
}
