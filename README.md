# Pooklet

Pooklet turns personal words into one of three private recipient websites: **Celebrating**, **Loving**, or **I Am Sorry**. It is a Telegram-first ₹10 application with a web creator, Razorpay Standard Checkout, signed automatic payment verification, private cute links, and recipient QR delivery.

## What is implemented

- React/Vite creator and three distinct, responsive recipient websites.
- Node HTTP API, Razorpay SDK, SQLite, static web serving, and Telegram polling in one process.
- Server-owned ₹10 price (`1000` paise), currency, and immutable story snapshot.
- A Razorpay order for every Pooklet order; the key secret never reaches the browser.
- Browser callback verification with HMAC-SHA256 over `order_id|payment_id`.
- Raw-body `order.paid` webhook verification, captured-payment checks, event-ID deduplication, and idempotent fulfillment.
- One transactional payment commit that marks the order fulfilled and creates one invitation.
- Private `/p/:slug` links with a cute word pair plus a 96-bit random suffix.
- A recipient QR containing only the private invitation URL.
- Telegram creation, secure-checkout links, `STATUS` recovery, and invitation delivery through the official Bot API.
- A single GitHub-to-Railway service configuration in `railway.json`.

## Payment and fulfillment model

```text
web or Telegram GiftDraft
  → POST /api/orders
  → server creates a ₹10 Razorpay order
  → browser opens Razorpay Standard Checkout
  → signed Checkout callback ─┐
                              ├→ idempotent payment transaction
  → signed order.paid webhook ┘     ├→ order = fulfilled
                                    ├→ one private invitation
                                    └→ Telegram delivery attempt
```

The callback endpoint verifies all three Razorpay fields against the provider order stored by the server. The webhook endpoint verifies `X-Razorpay-Signature` against the untouched request body and deduplicates `x-razorpay-event-id`. It accepts only `order.paid` payloads whose payment is captured and whose provider order/payment IDs, amount, and currency agree.

Checkout and webhook can arrive in either order. Unique provider IDs plus one SQLite transaction prevent duplicate invitations. A mismatched signature returns `400`/`401` and never fulfills the order. The retired UTR/admin flow is not exposed.

## Project layout

```text
apps/
  api/       Node HTTP API, Razorpay, SQLite, Telegram, static web host
  web/       React/Vite creator, Checkout, and recipient websites
packages/
  domain/    Validated gift/order contracts
  channels/  Conversation state machine and Telegram adapter
docs/
  architecture.md
railway.json
```

## Local setup

Requirements: Node.js **22.23.2** and npm 10.9.x. The exact Node version is in `.nvmrc`.

```bash
cp .env.example .env
npm install
```

For local UI and fulfillment work without contacting Razorpay, keep:

```dotenv
PAYMENT_PROVIDER=mock
```

Run the API and Vite app in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:8799`.

### Razorpay test-mode checkout

Put test credentials only in the ignored `.env` file:

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

Restart both development processes, create a Pooklet, click **Pay ₹10 with Razorpay**, and finish a test-mode payment in the hosted modal. The public key ID is returned by the API; `RAZORPAY_KEY_SECRET` remains server-only. Browser callback verification works locally. Testing the Razorpay webhook requires a public HTTPS URL (a deployed test service or a trusted tunnel) and a separate webhook secret.

The test key pasted during development is intentionally stored only in `.env`, which is ignored by Git. Never reuse test credentials as live credentials; rotate any key that is no longer meant to be shared.

### Useful routes

- `/` — landing and creator
- `/checkout/:orderId#access-token` — private Razorpay checkout
- `/p/:cute-slug` — fulfilled private recipient website
- `GET /api/health` — service/payment/channel readiness
- `POST /api/webhooks/razorpay` — signed `order.paid` webhook
- `POST /api/dev/bot` — development-only Telegram conversation simulator

Invitation and checkout URLs are bearer secrets. Anyone who receives one can use it, so share them carefully. Recipient pages are marked `noindex`.

## Telegram

Set a fresh BotFather token and use polling for the one-process Railway deployment:

```dotenv
TELEGRAM_MODE=polling
TELEGRAM_BOT_TOKEN=<fresh-BotFather-token>
```

Only one process may poll a bot token. The bot creates the same Razorpay-backed order as the web app and sends a private checkout link. After fulfillment it sends the invitation QR and link to the originating chat. If automatic delivery is interrupted, the creator can reply `STATUS`.

Optional Telegram webhook mode uses `POST /api/webhooks/telegram` and requires `TELEGRAM_WEBHOOK_SECRET`; do not run polling and webhook delivery for the same bot simultaneously.

## Deploy one service from GitHub to Railway

1. Push this workspace to a private or appropriately protected GitHub repository. Do not commit `.env`.
2. In Railway, create a project from that repository. Root `railway.json` builds all workspaces and starts `node apps/api/dist/server.js` through `npm start`.
3. Add a Railway volume mounted at `/data`, then set `DATABASE_PATH=/data/pooklet.db`.
4. Keep exactly **one replica**. SQLite, the mounted volume, and Telegram long polling are intentionally single-instance.
5. Generate a public Railway domain. Set `PUBLIC_BASE_URL` and `WEB_ORIGIN` to that exact HTTPS origin.
6. Add the variables below in Railway’s secret store.
7. In the Razorpay Dashboard for the matching test/live mode, create a webhook at `https://<your-domain>/api/webhooks/razorpay`, subscribe to `order.paid`, and enter the same independently generated value used for `RAZORPAY_WEBHOOK_SECRET`. Use automatic capture; the webhook intentionally accepts only captured payments.
8. Start the Telegram bot once from a real Telegram account and verify `GET /api/health`.

### Required Railway variables

```dotenv
NODE_ENV=production
DATABASE_PATH=/data/pooklet.db
PUBLIC_BASE_URL=https://<your-railway-domain>
WEB_ORIGIN=https://<your-railway-domain>

PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=<test-or-live-key-id>
RAZORPAY_KEY_SECRET=<matching-key-secret>
RAZORPAY_WEBHOOK_SECRET=<separate-random-dashboard-webhook-secret>
# Optional account binding:
RAZORPAY_ACCOUNT_ID=

INVITATION_SECRET=<at-least-32-random-characters>
TELEGRAM_MODE=polling
TELEGRAM_BOT_TOKEN=<fresh-BotFather-token>
```

Railway supplies `PORT`; do not hardcode it there. Generate server secrets independently, for example with `openssl rand -hex 32`. A webhook secret is not the Razorpay API key secret.

A volume is not declared in source and must be attached in Railway. Back it up. Do not enable horizontal replicas or overlapping consumers while using SQLite and Telegram polling; migrate to a shared database and durable delivery queue first.

## Build and validation

```bash
npm run typecheck
npm run build
npm audit
npm start
```

Then check `/api/health`, `/`, a deep route such as `/checkout/example`, order creation in Razorpay test mode, failed-signature rejection, one successful test payment, webhook replay behavior, the Telegram `STATUS` path, and the generated invitation URL/QR.

## Production notes

- Replace test keys with live keys only after Razorpay account activation and onboarding are complete.
- Add edge rate limits for public order creation and webhook endpoints.
- Establish refund, expiry, tax/invoice, deletion, retention, and support procedures.
- Protect and back up the SQLite volume; never include it in Git.
- Add a transactional delivery outbox before moving beyond one process.
- Add private object storage and media processing before enabling uploads.

Official references: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [Railway GitHub autodeploys](https://docs.railway.com/guides/github-autodeploys), [Railway volumes](https://docs.railway.com/reference/volumes), and the [Telegram Bot API](https://core.telegram.org/bots/api). Content based on these references is paraphrased.
