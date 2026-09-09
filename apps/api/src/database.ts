import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { OrderSource, OrderStatus, TemplateId } from "@pooklet/domain";

const sqliteModuleName = "node:sqlite";
const { DatabaseSync } = (await import(sqliteModuleName)) as typeof import("node:sqlite");

export type OrderRecord = {
  id: string;
  access_token_hash: string;
  source: OrderSource;
  template_id: TemplateId;
  to_name: string;
  from_name: string;
  snapshot_json: string;
  snapshot_hash: string;
  amount_paise: number;
  currency: "INR";
  status: OrderStatus;
  upi_uri: string;
  payment_utr: string | null;
  payment_paid_at: string | null;
  payment_submitted_at: string | null;
  verified_at: string | null;
  fulfilled_at: string | null;
  rejection_reason: string | null;
  payment_provider: "razorpay" | "mock" | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
};

export type NewOrderRecord = Omit<
  OrderRecord,
  | "payment_utr"
  | "payment_paid_at"
  | "payment_submitted_at"
  | "verified_at"
  | "fulfilled_at"
  | "rejection_reason"
  | "provider_payment_id"
>;

type InvitationRecord = {
  order_id: string;
  snapshot_json: string;
  token_hash: string;
  slug: string | null;
  status: string;
};

function paymentConflict(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 409 });
}

export class PookletStore {
  readonly #database: DatabaseSyncType;

  constructor(databasePath: string) {
    const absolutePath = resolve(databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.#database = new DatabaseSync(absolutePath);
    this.#database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.#migrate();
  }

  #migrate() {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        access_token_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        template_id TEXT NOT NULL,
        to_name TEXT NOT NULL,
        from_name TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL,
        amount_paise INTEGER NOT NULL CHECK (amount_paise = 1000),
        currency TEXT NOT NULL CHECK (currency = 'INR'),
        status TEXT NOT NULL,
        upi_uri TEXT NOT NULL,
        payment_utr TEXT,
        payment_paid_at TEXT,
        payment_submitted_at TEXT,
        verified_at TEXT,
        fulfilled_at TEXT,
        rejection_reason TEXT,
        payment_provider TEXT,
        provider_order_id TEXT,
        provider_payment_id TEXT,
        payment_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_utr
        ON orders(payment_utr)
        WHERE payment_utr IS NOT NULL;

      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
        token_hash TEXT NOT NULL UNIQUE,
        slug TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_sessions (
        channel TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (channel, user_id)
      );

      CREATE TABLE IF NOT EXISTS bot_events (
        channel TEXT NOT NULL,
        event_id TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (channel, event_id)
      );

      CREATE TABLE IF NOT EXISTS payment_events (
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (provider, event_id)
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL REFERENCES orders(id),
        event_type TEXT NOT NULL,
        detail_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
    `);

    const invitationColumns = this.#database
      .prepare("PRAGMA table_info(invitations)")
      .all() as unknown as Array<{ name: string }>;
    if (!invitationColumns.some((column) => column.name === "slug")) {
      this.#database.exec("ALTER TABLE invitations ADD COLUMN slug TEXT");
    }

    const orderColumns = this.#database
      .prepare("PRAGMA table_info(orders)")
      .all() as unknown as Array<{ name: string }>;
    for (const [name, sqlType] of [
      ["payment_provider", "TEXT"],
      ["provider_order_id", "TEXT"],
      ["provider_payment_id", "TEXT"],
      ["payment_status", "TEXT"],
    ] as const) {
      if (!orderColumns.some((column) => column.name === name)) {
        this.#database.exec(`ALTER TABLE orders ADD COLUMN ${name} ${sqlType}`);
      }
    }

    this.#database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_provider_order
        ON orders(provider_order_id) WHERE provider_order_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_provider_payment
        ON orders(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS invitations_unique_slug
        ON invitations(slug) WHERE slug IS NOT NULL;
    `);
  }

  createOrder(order: NewOrderRecord): OrderRecord {
    this.#database
      .prepare(`
        INSERT INTO orders (
          id, access_token_hash, source, template_id, to_name, from_name,
          snapshot_json, snapshot_hash, amount_paise, currency, status,
          upi_uri, payment_provider, provider_order_id, payment_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        order.id,
        order.access_token_hash,
        order.source,
        order.template_id,
        order.to_name,
        order.from_name,
        order.snapshot_json,
        order.snapshot_hash,
        order.amount_paise,
        order.currency,
        order.status,
        order.upi_uri,
        order.payment_provider,
        order.provider_order_id,
        order.payment_status,
        order.created_at,
        order.updated_at,
      );
    this.addAuditEvent(order.id, "order.created", {
      source: order.source,
      paymentProvider: order.payment_provider,
    });
    return this.getOrder(order.id)!;
  }

  getOrder(id: string): OrderRecord | undefined {
    return this.#database.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
      | OrderRecord
      | undefined;
  }

  attachPaymentOrder(
    id: string,
    provider: "razorpay" | "mock",
    providerOrderId: string,
    now: string,
  ): OrderRecord {
    this.#database
      .prepare(`
        UPDATE orders SET payment_provider = ?, provider_order_id = ?,
          payment_status = 'created', updated_at = ?
        WHERE id = ? AND provider_order_id IS NULL
      `)
      .run(provider, providerOrderId, now, id);
    return this.getOrder(id)!;
  }

  getOrderByProviderOrder(provider: string, providerOrderId: string): OrderRecord | undefined {
    return this.#database
      .prepare("SELECT * FROM orders WHERE payment_provider = ? AND provider_order_id = ?")
      .get(provider, providerOrderId) as OrderRecord | undefined;
  }

  recordCapturedPayment(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadHash: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountPaise: number;
    currency: string;
    invitationId: string;
    tokenHash: string;
    slug: string;
    now: string;
  }): { order: OrderRecord; newlyFulfilled: boolean } {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.getOrderByProviderOrder(input.provider, input.providerOrderId);
      if (!existing) throw new Error("Payment order was not found");
      if (existing.amount_paise !== input.amountPaise || existing.currency !== input.currency) {
        throw paymentConflict("Payment amount or currency did not match.");
      }

      const event = this.#database
        .prepare(`
          INSERT OR IGNORE INTO payment_events
            (provider, event_id, event_type, payload_hash, received_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(input.provider, input.eventId, input.eventType, input.payloadHash, input.now);

      if (event.changes === 0) {
        const storedEvent = this.#database
          .prepare(`
            SELECT payload_hash FROM payment_events
            WHERE provider = ? AND event_id = ?
          `)
          .get(input.provider, input.eventId) as { payload_hash: string } | undefined;
        if (!storedEvent || storedEvent.payload_hash !== input.payloadHash) {
          throw paymentConflict("Payment event ID was reused with a different payload.");
        }
        if (
          existing.provider_payment_id &&
          existing.provider_payment_id !== input.providerPaymentId
        ) {
          throw paymentConflict("Payment ID did not match the fulfilled order.");
        }
        this.#database.exec("COMMIT");
        return { order: this.getOrder(existing.id)!, newlyFulfilled: false };
      }

      if (existing.status === "fulfilled") {
        if (
          existing.provider_payment_id &&
          existing.provider_payment_id !== input.providerPaymentId
        ) {
          throw paymentConflict("Payment ID did not match the fulfilled order.");
        }
        if (!existing.provider_payment_id) {
          this.#database
            .prepare(`
              UPDATE orders SET payment_status = 'captured', provider_payment_id = ?,
                payment_paid_at = COALESCE(payment_paid_at, ?), updated_at = ?
              WHERE id = ?
            `)
            .run(input.providerPaymentId, input.now, input.now, existing.id);
        }
        this.#database.exec("COMMIT");
        return { order: this.getOrder(existing.id)!, newlyFulfilled: false };
      }

      if (!["awaiting_payment", "proof_submitted", "rejected"].includes(existing.status)) {
        throw paymentConflict("Order cannot accept a captured payment in its current state.");
      }

      this.#database
        .prepare(`
          UPDATE orders SET status = 'fulfilled', payment_status = 'captured',
            provider_payment_id = ?, payment_paid_at = ?, verified_at = ?,
            fulfilled_at = ?, rejection_reason = NULL, updated_at = ?
          WHERE id = ?
        `)
        .run(
          input.providerPaymentId,
          input.now,
          input.now,
          input.now,
          input.now,
          existing.id,
        );
      this.#database
        .prepare(`
          INSERT INTO invitations (id, order_id, token_hash, slug, status, created_at)
          VALUES (?, ?, ?, ?, 'active', ?)
        `)
        .run(input.invitationId, existing.id, input.tokenHash, input.slug, input.now);
      this.addAuditEvent(existing.id, "payment.captured", {
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
      });
      this.addAuditEvent(existing.id, "order.fulfilled", {});
      this.#database.exec("COMMIT");
      return { order: this.getOrder(existing.id)!, newlyFulfilled: true };
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  getInvitation(tokenHash: string): InvitationRecord | undefined {
    return this.#database
      .prepare(`
        SELECT invitations.order_id, invitations.token_hash, invitations.slug,
               invitations.status, orders.snapshot_json
        FROM invitations
        JOIN orders ON orders.id = invitations.order_id
        WHERE invitations.token_hash = ? AND invitations.status = 'active'
          AND orders.status = 'fulfilled'
      `)
      .get(tokenHash) as InvitationRecord | undefined;
  }

  getInvitationBySlug(slug: string): InvitationRecord | undefined {
    return this.#database
      .prepare(`
        SELECT invitations.order_id, invitations.token_hash, invitations.slug,
               invitations.status, orders.snapshot_json
        FROM invitations
        JOIN orders ON orders.id = invitations.order_id
        WHERE invitations.slug = ? AND invitations.status = 'active'
          AND orders.status = 'fulfilled'
      `)
      .get(slug) as InvitationRecord | undefined;
  }

  getInvitationForOrder(orderId: string): InvitationRecord | undefined {
    return this.#database
      .prepare(`
        SELECT invitations.order_id, invitations.token_hash, invitations.slug,
               invitations.status, orders.snapshot_json
        FROM invitations
        JOIN orders ON orders.id = invitations.order_id
        WHERE invitations.order_id = ? AND invitations.status = 'active'
          AND orders.status = 'fulfilled'
      `)
      .get(orderId) as InvitationRecord | undefined;
  }

  setInvitationSlug(orderId: string, slug: string): InvitationRecord | undefined {
    this.#database
      .prepare("UPDATE invitations SET slug = ? WHERE order_id = ? AND slug IS NULL")
      .run(slug, orderId);
    return this.getInvitationForOrder(orderId);
  }

  getBotSession(channel: string, userId: string): string | undefined {
    const row = this.#database
      .prepare("SELECT session_json FROM bot_sessions WHERE channel = ? AND user_id = ?")
      .get(channel, userId) as { session_json: string } | undefined;
    return row?.session_json;
  }

  findBotSessionByOrder(
    channel: string,
    orderId: string,
  ): { userId: string; sessionJson: string } | undefined {
    const row = this.#database
      .prepare(`
        SELECT user_id, session_json
        FROM bot_sessions
        WHERE channel = ? AND json_extract(session_json, '$.orderId') = ?
        LIMIT 1
      `)
      .get(channel, orderId) as { user_id: string; session_json: string } | undefined;
    return row ? { userId: row.user_id, sessionJson: row.session_json } : undefined;
  }

  saveBotSession(channel: string, userId: string, sessionJson: string) {
    this.#database
      .prepare(`
        INSERT INTO bot_sessions (channel, user_id, session_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(channel, user_id) DO UPDATE SET
          session_json = excluded.session_json,
          updated_at = excluded.updated_at
      `)
      .run(channel, userId, sessionJson, new Date().toISOString());
  }

  claimBotEvent(channel: string, eventId: string): boolean {
    const result = this.#database
      .prepare(`
        INSERT OR IGNORE INTO bot_events (channel, event_id, received_at)
        VALUES (?, ?, ?)
      `)
      .run(channel, eventId, new Date().toISOString());
    return result.changes === 1;
  }

  addAuditEvent(orderId: string, eventType: string, details: Record<string, unknown>) {
    this.#database
      .prepare(`
        INSERT INTO audit_events (order_id, event_type, detail_json, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(orderId, eventType, JSON.stringify(details), new Date().toISOString());
  }
}
