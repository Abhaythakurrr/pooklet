import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
} catch {
  // Railway and other process managers supply environment variables directly.
}

const isProduction = process.env.NODE_ENV === "production";

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 8799);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function isHttpsOrigin(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function railwayHttpsOrigin(value: string | undefined): string | undefined {
  const domain = value?.trim();
  if (!domain) return undefined;
  try {
    const url = new URL(domain.includes("://") ? domain : `https://${domain}`);
    url.protocol = "https:";
    return url.origin;
  } catch {
    throw new Error("RAILWAY_PUBLIC_DOMAIN must contain a valid public service domain.");
  }
}

function selectOrigin(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  // In Railway production, replace stale localhost/http values with the
  // platform-generated HTTPS domain. Explicit custom HTTPS origins still win.
  if (isProduction && !isHttpsOrigin(candidate)) return fallback;
  return candidate;
}

function parseOrigin(name: string, value: string | undefined, fallback: string): string {
  let url: URL;
  try {
    url = new URL(value?.trim() || fallback);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use http or https.`);
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url.origin;
}

const providerValue = process.env.PAYMENT_PROVIDER?.trim() || "razorpay";
if (providerValue !== "razorpay" && providerValue !== "mock") {
  throw new Error("PAYMENT_PROVIDER must be razorpay or mock.");
}
const paymentProvider: "razorpay" | "mock" = providerValue;

const telegramModeValue = process.env.TELEGRAM_MODE?.trim() || "polling";
if (telegramModeValue !== "polling" && telegramModeValue !== "webhook") {
  throw new Error("TELEGRAM_MODE must be polling or webhook.");
}
const telegramMode: "polling" | "webhook" = telegramModeValue;

const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
const razorpayAccountId = process.env.RAZORPAY_ACCOUNT_ID?.trim() || "";
const paymentConfigured =
  paymentProvider === "mock" || Boolean(razorpayKeyId && razorpayKeySecret);
const paymentWebhookConfigured =
  paymentProvider === "mock" || razorpayWebhookSecret.length >= 16;

const invitationSecret =
  process.env.INVITATION_SECRET?.trim() || "local-invitation-secret-change-before-production";
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";

const railwayOrigin = railwayHttpsOrigin(process.env.RAILWAY_PUBLIC_DOMAIN);
if (isProduction && !railwayOrigin && !isHttpsOrigin(process.env.PUBLIC_BASE_URL)) {
  throw new Error(
    "Generate a Railway public domain or set PUBLIC_BASE_URL to the service's HTTPS origin.",
  );
}
const publicFallback = railwayOrigin ?? "http://localhost:5173";
const publicBaseUrl = parseOrigin(
  "PUBLIC_BASE_URL",
  selectOrigin(process.env.PUBLIC_BASE_URL, publicFallback),
  publicFallback,
);
const webOrigin = parseOrigin(
  "WEB_ORIGIN",
  selectOrigin(process.env.WEB_ORIGIN, publicBaseUrl),
  publicBaseUrl,
);

if (isProduction && paymentProvider !== "razorpay") {
  throw new Error("Production requires PAYMENT_PROVIDER=razorpay.");
}
if (isProduction && !paymentConfigured) {
  throw new Error("Production requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
}
if (isProduction && !paymentWebhookConfigured) {
  throw new Error("Production requires a RAZORPAY_WEBHOOK_SECRET of at least 16 characters.");
}
if (isProduction && invitationSecret.length < 32) {
  throw new Error("Production requires an INVITATION_SECRET of at least 32 characters.");
}
if (isProduction && !telegramBotToken) {
  throw new Error("Production Telegram mode requires TELEGRAM_BOT_TOKEN.");
}
if (isProduction && telegramMode === "webhook" && telegramWebhookSecret.length < 16) {
  throw new Error(
    "Telegram webhook mode requires a TELEGRAM_WEBHOOK_SECRET of at least 16 characters.",
  );
}

export const config = {
  port: parsePort(process.env.PORT),
  databasePath: process.env.DATABASE_PATH?.trim() || "./data/pooklet.db",
  publicBaseUrl,
  webOrigin,
  paymentProvider,
  paymentConfigured,
  paymentWebhookConfigured,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
  razorpayAccountId,
  invitationSecret,
  telegramMode,
  telegramBotToken,
  telegramWebhookSecret,
  isProduction,
} as const;
