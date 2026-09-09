import { useCallback, useEffect, useState } from "react";
import {
  completeMockPayment,
  ensurePaymentSession,
  getOrder,
  verifyRazorpayPayment,
  type OrderView,
} from "../api";

type RazorpayResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayFailure = { error?: { description?: string } };
type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", callback: (response: RazorpayFailure) => void): void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export function CheckoutPage({ orderId }: { orderId: string }) {
  const [accessToken] = useState(() => {
    const fragmentToken = window.location.hash.slice(1);
    const stored = sessionStorage.getItem(`pooklet-order:${orderId}`);
    const token = fragmentToken || stored || "";
    if (fragmentToken) {
      sessionStorage.setItem(`pooklet-order:${orderId}`, fragmentToken);
      history.replaceState(null, "", window.location.pathname);
    }
    return token;
  });
  const [order, setOrder] = useState<OrderView>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      setOrder(await getOrder(orderId, accessToken));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  const waitForWebhook = useCallback(async (): Promise<OrderView | undefined> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const current = await getOrder(orderId, accessToken);
      if (current.status === "fulfilled") return current;
      await wait(1_500);
    }
    return undefined;
  }, [accessToken, orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pay = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const ready = await ensurePaymentSession(orderId, accessToken);
      setOrder(ready);
      if (ready.payment?.mock) {
        setOrder(await completeMockPayment(orderId, accessToken));
        return;
      }
      if (!ready.payment?.publicKey || !ready.payment.providerOrderId || !window.Razorpay) {
        throw new Error("Secure checkout could not be loaded. Please refresh and try again.");
      }

      const checkout = new window.Razorpay({
        key: ready.payment.publicKey,
        amount: ready.amountPaise,
        currency: ready.currency,
        name: "Pooklet",
        description: `Private Pooklet for ${ready.toName}`,
        order_id: ready.payment.providerOrderId,
        handler: async (result: RazorpayResult) => {
          setLoading(true);
          setError("");
          setNotice("Payment received. Verifying the signed response…");
          try {
            setOrder(await verifyRazorpayPayment(orderId, accessToken, result));
            setNotice("");
          } catch {
            // A network interruption can lose the browser callback while the
            // signed order.paid webhook still fulfills the order.
            setNotice("Payment received. Waiting for secure server confirmation…");
            try {
              const recovered = await waitForWebhook();
              if (recovered) {
                setOrder(recovered);
                setNotice("");
              } else {
                setError(
                  "Payment confirmation is taking longer than expected. Use Check payment status in a moment; do not pay again.",
                );
              }
            } catch {
              setError(
                "Payment confirmation could not be refreshed. Use Check payment status; do not pay again.",
              );
            }
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setNotice("Checkout closed. Your order is still safe—you can try again.");
            setLoading(false);
          },
        },
        theme: { color: "#b65f77" },
      });
      checkout.on("payment.failed", (response) => {
        setNotice("");
        setError(response.error?.description || "Payment failed. No invitation was published.");
        setLoading(false);
      });
      checkout.open();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not start.");
      setLoading(false);
    }
  };

  if (!accessToken) {
    return (
      <main className="status-page">
        <div className="status-card">
          <p className="object-label">Private order</p>
          <h1>This checkout link is incomplete.</h1>
          <p>Open the original link from the browser or bot that created the order.</p>
          <a className="button button--ink" href="/">Return home</a>
        </div>
      </main>
    );
  }
  if (!order && loading) {
    return <main className="status-page"><p className="loading-line">Preparing secure checkout…</p></main>;
  }

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <a className="brand" href="/"><span className="brand__mark">P</span><span>Pooklet</span></a>
        <span>Secure order · {orderId}</span>
      </header>
      <div className="checkout-layout">
        <section className="checkout-story">
          <p className="eyebrow"><span /> Your story is waiting</p>
          <h1>One small payment.<br /><em>One private world.</em></h1>
          {order && <p>Your private website for <strong>{order.toName}</strong> is sealed into order {order.id}.</p>}
          <div className="checkout-steps">
            <div className="is-current"><span>01</span><p><b>Pay ₹10 securely</b><small>Razorpay opens a protected checkout modal.</small></p></div>
            <div className={order?.status === "fulfilled" ? "is-current" : ""}><span>02</span><p><b>Automatic verification</b><small>The signed response is verified on the server.</small></p></div>
            <div className={order?.status === "fulfilled" ? "is-current" : ""}><span>03</span><p><b>Receive the invitation</b><small>Your cute link and QR appear instantly.</small></p></div>
          </div>
        </section>
        <section className="payment-paper" aria-labelledby="payment-title">
          <div className="payment-paper__top">
            <div><p className="object-label">Pooklet order</p><h2 id="payment-title">₹10.00</h2></div>
            <span className={`status-stamp status-stamp--${order?.status ?? "loading"}`}>{order?.status.replaceAll("_", " ") ?? "loading"}</span>
          </div>
          {order?.status === "fulfilled" && order.invitationUrl ? (
            <div className="invitation-ready">
              <p className="object-label">Payment verified · private link</p>
              <h3>Your Pooklet is ready.</h3>
              {order.invitationQrCodeDataUrl && (
                <div className="recipient-qr-wrap">
                  <span aria-hidden="true">✦</span>
                  <img className="recipient-qr" src={order.invitationQrCodeDataUrl} alt={`QR code that opens ${order.toName}'s private Pooklet`} />
                  <span aria-hidden="true">♡</span>
                </div>
              )}
              <p className="recipient-qr-note">Let {order.toName} scan this code, or send the cute link.</p>
              <a className="button button--ink" href={order.invitationUrl}>Open private Pooklet</a>
              <button type="button" className="text-button" onClick={() => void navigator.clipboard.writeText(order.invitationUrl!)}>Copy cute link</button>
            </div>
          ) : (
            <div className="proof-waiting">
              <h3>Ready for secure checkout.</h3>
              <p>Payment is accepted by Razorpay. Pooklet verifies the signature on the server before publishing anything.</p>
              <button className="button button--upi" type="button" onClick={() => void pay()} disabled={loading || !order?.paymentConfigured}>{loading ? "Preparing…" : "Pay ₹10 with Razorpay"}</button>
              <button className="text-button" type="button" onClick={() => void refresh()} disabled={loading}>Check payment status</button>
            </div>
          )}
          {!order?.paymentConfigured && <p className="setup-warning">Razorpay is not configured on the server.</p>}
          {notice && <p className="recipient-qr-note" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}
