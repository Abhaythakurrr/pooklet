import type { StorySnapshot, TemplateId } from "@pooklet/domain";

export type OrderView = {
  id: string;
  source: string;
  templateId: TemplateId;
  toName: string;
  fromName: string;
  amountPaise: number;
  amountDisplay: string;
  currency: "INR";
  status:
    | "awaiting_payment"
    | "proof_submitted"
    | "verified"
    | "fulfilled"
    | "rejected"
    | "expired";
  paymentConfigured: boolean;
  payment: {
    provider: "razorpay" | "mock";
    providerOrderId: string;
    publicKey: string | null;
    status: string | null;
    mock: boolean;
  } | null;
  invitationQrCodeDataUrl?: string;
  invitationUrl: string | null;
  accessToken?: string;
  createdAt: string;
  updatedAt: string;
};

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{ path: string; message: string }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as T & ApiErrorPayload;
  if (!response.ok) {
    const details = payload.issues?.map((issue) => issue.message).join(" ");
    throw new Error(details || payload.error || "This request could not be completed.");
  }
  return payload;
}

export function createOrder(input: unknown) {
  return request<OrderView & { accessToken: string }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getOrder(id: string, accessToken: string) {
  return request<OrderView>(`/api/orders/${encodeURIComponent(id)}`, {
    headers: { "x-order-token": accessToken },
  });
}

export function ensurePaymentSession(id: string, accessToken: string) {
  return request<OrderView>(`/api/orders/${encodeURIComponent(id)}/payment-session`, {
    method: "POST",
    headers: { "x-order-token": accessToken },
    body: "{}",
  });
}

export function verifyRazorpayPayment(
  id: string,
  accessToken: string,
  input: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  },
) {
  return request<OrderView>(`/api/orders/${encodeURIComponent(id)}/verify-payment`, {
    method: "POST",
    headers: { "x-order-token": accessToken },
    body: JSON.stringify(input),
  });
}

export function completeMockPayment(id: string, accessToken: string) {
  return request<OrderView>(`/api/dev/orders/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    headers: { "x-order-token": accessToken },
    body: "{}",
  });
}

export function getInvitation(token: string) {
  return request<StorySnapshot>(`/api/invitations/${encodeURIComponent(token)}`);
}

export function getInvitationBySlug(slug: string) {
  return request<StorySnapshot>(`/api/p/${encodeURIComponent(slug)}`);
}
