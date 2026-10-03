import { numbers } from "./library";

/**
 * Share links carry the whole pattern in the URL fragment (#p=…), compressed.
 * The fragment never reaches a server. A link is untrusted input: its code
 * only ever runs in the sandbox worker, and its name is shown as plain text.
 */
export interface Shared {
  name: string;
  code: string;
  values: Record<string, number>;
}

const MAX_CODE = 50_000;

export async function encodeShare(p: Shared): Promise<string> {
  const json = JSON.stringify({ v: 1, n: p.name, c: p.code, d: p.values });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function decodeShare(data: string): Promise<Shared | null> {
  try {
    if (data.length > 200_000) return null;
    const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const text = await new Response(stream).text();
    if (text.length > MAX_CODE * 2) return null;
    const o = JSON.parse(text);
    if (!o || typeof o.c !== "string" || o.c.length > MAX_CODE) return null;
    return {
      name: typeof o.n === "string" ? o.n.slice(0, 80) : "Shared pattern",
      code: o.c,
      values: numbers(o.d),
    };
  } catch {
    return null;
  }
}
