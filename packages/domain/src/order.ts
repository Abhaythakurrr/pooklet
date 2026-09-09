import { z } from "zod";
import { giftDraftSchema } from "./gift";

export const ORDER_PRICE_PAISE = 1_000;
export const ORDER_CURRENCY = "INR" as const;

export const ORDER_SOURCES = ["web", "telegram"] as const;
export const orderSourceSchema = z.enum(ORDER_SOURCES);

export const ORDER_STATUSES = [
  "awaiting_payment",
  "proof_submitted",
  "verified",
  "fulfilled",
  "rejected",
  "expired",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const createOrderRequestSchema = z
  .object({
    source: orderSourceSchema.default("web"),
    gift: giftDraftSchema,
  })
  .strict();

export const paymentProofSchema = z
  .object({
    utr: z
      .string()
      .trim()
      .min(6)
      .max(50)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Enter a valid bank reference or UTR."),
    paidAt: z.string().datetime().optional(),
  })
  .strict();

export const rejectionSchema = z
  .object({
    reason: z.string().trim().min(3).max(400),
  })
  .strict();

export type OrderSource = z.infer<typeof orderSourceSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type PaymentProof = z.infer<typeof paymentProofSchema>;

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ["proof_submitted", "expired"],
  proof_submitted: ["verified", "rejected"],
  verified: ["fulfilled"],
  fulfilled: [],
  rejected: ["proof_submitted", "expired"],
  expired: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}
