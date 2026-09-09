# Pooklet Architecture

## Runtime boundary

Pooklet deploys as one Node.js process:

```text
Railway HTTPS service
  └─ Node HTTP server
      ├─ JSON API
      ├─ Razorpay raw-body webhook
      ├─ Telegram polling (or optional Telegram webhook)
      ├─ SQLite on a mounted volume
      └─ React/Vite production files + SPA fallback
```

The root build compiles `apps/api/dist/server.js` and `apps/web/dist`. `apps/api/src/static.ts` serves hashed assets with immutable caching and returns `index.html` for non-API deep routes. One root `npm start` therefore owns the web app, API, payment webhook, database, and Telegram consumer.

This topology requires one replica. A second process would compete for Telegram updates and a mounted SQLite database. Horizontal scaling requires a shared database and durable queue/outbox first.

## Boundaries

1. **Domain (`packages/domain`)** — validated gift content, fixed ₹10 price, order sources, and persisted status vocabulary.
2. **Payments/API (`apps/api`)** — local/provider order mapping, signed callback and webhook verification, SQLite fulfillment, invitations, and HTTP/static serving.
3. **Channels (`packages/channels`, `apps/api/src/bots.ts`)** — persisted Telegram conversation state, official Bot API transport, checkout/status messages, and invitation delivery.
4. **Presentation (`apps/web`)** — creator, Razorpay Standard Checkout, fulfillment status, and three recipient websites.

Web and Telegram authoring produce the same `GiftDraft`. The API validates it again and stores an immutable `StorySnapshot` plus SHA-256 hash.

## Order creation

```text
POST /api/orders
  ├─ validate GiftDraft
  ├─ generate local PKT order ID
  ├─ generate 192-bit checkout access token
  ├─ freeze server-owned amount=1000 and currency=INR
  ├─ create Razorpay order with PKT receipt/note
  └─ persist local order + provider order ID
```

The provider order is created before local persistence, so a provider/authentication failure cannot strand a local row whose one-time access token was never returned. Only the SHA-256 hash of that token is stored. The browser receives the raw token once in the checkout URL fragment, copies it to `sessionStorage`, then removes the fragment from browser history.

The public Razorpay key ID is returned as payment-session metadata. The API key secret and webhook secret remain server-only.

## Checkout callback

The browser sends `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to:

```text
POST /api/orders/:localOrderId/verify-payment
x-order-token: <private checkout token>
```

The server requires the callback order ID to equal the provider order ID stored for that local order. It calculates:

```text
HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
```

A constant-time comparison must match before fulfillment. Missing/mismatched fields return `400` and do not change order state.

If the callback request is interrupted after the hosted modal reports success, the checkout page polls order status briefly. The signed webhook remains the server-to-server recovery path.

## Razorpay webhook

`POST /api/webhooks/razorpay` reads the size-limited body before any JSON parsing. `RazorpayGateway`:

1. Computes HMAC-SHA256 over the untouched body with `RAZORPAY_WEBHOOK_SECRET`.
2. Constant-time compares `X-Razorpay-Signature`.
3. Requires `x-razorpay-event-id` as the provider idempotency key.
4. Parses JSON only after signature acceptance.
5. Ignores other signed event types.
6. For `order.paid`, requires captured payment state, paid order state, matching provider IDs, and matching payment/order amount and currency.
7. Optionally binds `account_id` when `RAZORPAY_ACCOUNT_ID` is configured.

A webhook secret is independent from the Razorpay API key secret. A malformed signed payload returns `400`; an invalid signature returns `401`; missing server configuration returns `503`.

## Idempotent fulfillment

Checkout callbacks and webhooks call one `recordCapturedPayment` transaction:

```text
BEGIN IMMEDIATE
  resolve (provider, provider_order_id)
  validate server-owned amount/currency
  claim (provider, event_id) with payload hash
  reject event-ID reuse with a changed payload
  reject conflicting provider payment IDs
  mark order fulfilled/captured
  create exactly one invitation
  append payment + fulfillment audit events
COMMIT
```

Unique indexes protect provider order IDs, provider payment IDs, event IDs, one invitation per local order, invitation token hashes, and cute slugs. A callback/webhook race can therefore converge without publishing twice. Legacy proof/rejected rows can still be reconciled by a valid captured payment, but the old manual endpoints and UI are no longer exposed.

## Invitation privacy

A fulfilled invitation uses `/p/<adjective>-<noun>-<96-bit-random-suffix>`. Friendly words are presentation; random entropy supplies guessing resistance. A high-error-correction QR encodes only this private recipient URL, never the checkout token or payment details.

Recipient APIs require an active invitation and fulfilled order. Recipient pages render user input as text, do not inject HTML, and set `noindex,nofollow,noarchive`. Invitation URLs remain bearer secrets rather than authenticated accounts.

## Telegram flow

```text
Telegram getUpdates (one poller)
  → verify/normalize update
  → claim update ID in SQLite
  → load sender conversation
  → validate answers
  → create the same Razorpay-backed order
  → send private /checkout/:id#token URL
  → STATUS reads trusted local state

payment fulfillment
  → find originating Telegram session by order ID
  → send invitation URL + QR with sendPhoto
  → mark invitationDeliveredAt
```

A pending session is not discarded by `RESTART`, preserving the order-to-chat association until payment completes. `STATUS` recovers the invitation if automatic delivery was interrupted. A Razorpay webhook delivery error is retryable; payment and invitation creation remain committed and idempotent.

This is reliable enough for a one-process MVP but is not a general durable outbox. Before multi-process scaling, persist delivery jobs independently from mutable conversation state and process them through a shared queue.

## Storage

- `orders` — immutable story snapshot, hashed checkout token, server-owned amount/currency, local status, and provider order/payment mapping.
- `payment_events` — provider event deduplication key, type, and payload hash.
- `invitations` — one active invitation/token hash/cute slug per fulfilled order.
- `audit_events` — order/payment decisions without story text.
- `bot_sessions` — Telegram authoring, pending order, and delivery state by sender.
- `bot_events` — Telegram update deduplication.

Existing UTR-era columns remain in `orders` only for migration compatibility. They are not part of the active API.

## Railway deployment

`railway.json` selects RAILPACK, runs `npm ci && npm run build`, starts `npm start`, and checks `/api/health`. Node is pinned to 22.23.2 because the API uses `node:sqlite`.

Required external setup:

- Attach a Railway volume at `/data` and set `DATABASE_PATH=/data/pooklet.db`.
- Keep one replica.
- Set public HTTPS origin, Razorpay, invitation, and Telegram secrets in Railway.
- Configure Razorpay `order.paid` to `/api/webhooks/razorpay` with the matching webhook secret.
- Use Telegram polling for the simplest one-process deployment.

The volume and Razorpay/Telegram dashboard registrations are external resources and cannot be created by repository configuration alone.

## Security properties

Implemented:

- Server-owned amount/currency and immutable story snapshots.
- Provider order creation with server-only API credentials.
- Constant-time checkout/webhook HMAC comparisons.
- Raw-body webhook verification before JSON parsing.
- Captured-payment and account-binding checks.
- Transactional payment/event idempotency and conflict detection.
- Hash-only checkout and legacy invitation token storage.
- High-entropy recipient slugs.
- Size-limited request bodies and runtime schema validation.
- Neutral invalid-order/invitation responses.
- Optional Telegram webhook-secret validation.
- No story text or secrets in normal logs/health responses.

Still required operationally:

- Edge rate limits and abuse controls.
- SQLite backups, retention/deletion workflows, and secret rotation.
- Refund, expiry, invoice/tax, and customer-support procedures.
- A transactional delivery outbox before horizontal scaling.
- Private media storage and isolated processing before uploads.

Official references: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [Railway volumes](https://docs.railway.com/reference/volumes), and the [Telegram Bot API](https://core.telegram.org/bots/api). Content based on these references is paraphrased.
