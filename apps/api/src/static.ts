import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
const mimeTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2" };

async function existingFile(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

export async function serveWeb(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (!['GET', 'HEAD'].includes(request.method ?? '') || pathname.startsWith('/api/')) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const candidate = resolve(webRoot, `.${decoded}`);
  const safe = candidate === webRoot || candidate.startsWith(`${webRoot}${sep}`);
  const filePath = safe && await existingFile(candidate) ? candidate : resolve(webRoot, "index.html");
  if (!await existingFile(filePath)) return false;
  const body = await readFile(filePath);
  response.setHeader("content-type", mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("cache-control", pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  response.writeHead(200, { "content-length": body.byteLength });
  if (request.method !== "HEAD") response.end(body); else response.end();
  return true;
}
