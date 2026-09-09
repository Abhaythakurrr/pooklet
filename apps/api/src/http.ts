import type { IncomingMessage, ServerResponse } from "node:http";

export async function readBody(request: IncomingMessage, maximumBytes = 128_000) {
  let received = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;
    if (received > maximumBytes) {
      throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request: IncomingMessage, maximumBytes = 128_000) {
  const body = await readBody(request, maximumBytes);
  if (!body) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function requestToken(request: IncomingMessage, headerName: string): string | undefined {
  const value = request.headers[headerName.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
