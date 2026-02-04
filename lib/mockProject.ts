export type CustomerStatus = "New" | "Trial" | "Active" | "Stopped";

export type CustomerRow = {
  id: string;
  customer: string;
  email: string;
  status: CustomerStatus;
  pendingActions: number;
};

export type FileNode =
  | { type: "folder"; name: string; children: FileNode[]; defaultOpen?: boolean }
  | { type: "file"; name: string; content: string; language: "ts" | "html" | "css" };

export type ProjectMock = {
  id: string;
  name: string;
  customers: CustomerRow[];
  tree: FileNode[];
};

export const mockProject: ProjectMock = {
  id: "1",
  name: "SaaS Admin Dashboard",
  customers: [
    { id: "c1", customer: "Jane Doe", email: "Jane hraagy", status: "New", pendingActions: 11 },
    { id: "c2", customer: "John Smith", email: "Joho htargy", status: "Trial", pendingActions: 6 },
    { id: "c3", customer: "Alice Parker", email: "Jane hraagy", status: "Active", pendingActions: 6 },
    { id: "c4", customer: "Bob Roberts", email: "Jash boagy", status: "Stopped", pendingActions: 9 },
  ],
  tree: [
    { type: "file", name: "css", content: "", language: "css" },
    { type: "folder", name: "components", children: [], defaultOpen: false },
    { type: "folder", name: "Backup", children: [], defaultOpen: false },
    { type: "folder", name: "setup", children: [], defaultOpen: false },
    { type: "folder", name: "temp", children: [], defaultOpen: false },
    {
      type: "folder",
      name: "Html",
      defaultOpen: true,
      children: [
        { type: "file", name: "index.html", language: "html", content: "<!-- index.html -->\n<div id=\"app\"></div>\n" },
        { type: "file", name: "style.css", language: "css", content: "/* style.css */\nbody{ margin:0; }\n" },
      ],
    },
  ],
};

export function flattenFiles(nodes: FileNode[], prefix = ""): Array<{ path: string; node: Extract<FileNode, { type: "file" }> }> {
  const out: Array<{ path: string; node: Extract<FileNode, { type: "file" }> }> = [];
  for (const n of nodes) {
    if (n.type === "file") {
      const path = prefix ? `${prefix}/${n.name}` : n.name;
      out.push({ path, node: n });
    } else {
      const nextPrefix = prefix ? `${prefix}/${n.name}` : n.name;
      out.push(...flattenFiles(n.children, nextPrefix));
    }
  }
  return out;
}

export function toCSV(rows: CustomerRow[]): string {
  const header = ["Customer", "Email", "Status", "Pending Actions"];
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [header.map(escape).join(",")];
  for (const r of rows) {
    lines.push([r.customer, r.email, r.status, String(r.pendingActions)].map(escape).join(","));
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function mockProject(){ return null as any; }
