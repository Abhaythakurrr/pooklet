import { useState, type FormEvent } from "react";
import type { TemplateId } from "@pooklet/domain";
import { createOrder } from "../api";

type ComposerProps = {
  templateId: TemplateId;
  onClose: () => void;
};

type FormState = {
  toName: string;
  fromName: string;
  occasion: string;
  customOccasionLabel: string;
  spotlight: string;
  littleThing: string;
  whatHappened: string;
  responsibility: string;
  impact: string;
  repairStep: string;
  closing: string;
  letter: string;
};

const initialForm: FormState = {
  toName: "",
  fromName: "",
  occasion: "birthday",
  customOccasionLabel: "",
  spotlight: "",
  littleThing: "",
  whatHappened: "",
  responsibility: "",
  impact: "",
  repairStep: "",
  closing: "",
  letter: "",
};

const templateNames: Record<TemplateId, string> = {
  celebrating: "A night with their name on it",
  loving: "The house of little things",
  sorry: "A letter beside the rain",
};

export function Composer({ templateId, onClose }: ComposerProps) {
  const [stage, setStage] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const buildGift = () => {
    const shared = { toName: form.toName.trim(), fromName: form.fromName.trim() };
    if (templateId === "celebrating") {
      return {
        ...shared,
        templateId,
        occasion: form.occasion,
        customOccasionLabel:
          form.occasion === "custom" ? form.customOccasionLabel.trim() : undefined,
        spotlight: form.spotlight.trim(),
        memories: [],
        letter: form.letter.trim(),
      };
    }
    if (templateId === "loving") {
      return {
        ...shared,
        templateId,
        littleThings: [form.littleThing.trim()],
        memories: [],
        letter: form.letter.trim(),
      };
    }
    return {
      ...shared,
      templateId,
      whatHappened: form.whatHappened.trim(),
      responsibility: form.responsibility.trim(),
      impact: form.impact.trim(),
      repairStep: form.repairStep.trim(),
      closing: form.closing.trim(),
      boundaryNote: "You do not need to reply before you are ready.",
      memories: [],
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage < 2) {
      setStage((current) => current + 1);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await createOrder({ source: "web", gift: buildGift() });
      sessionStorage.setItem(`pooklet-order:${order.id}`, order.accessToken);
      window.location.assign(`/checkout/${order.id}#${order.accessToken}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be created.");
      setSubmitting(false);
    }
  };

  return (
    <div className="composer-backdrop" role="presentation">
      <section className={`composer composer--${templateId}`} role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="composer__rail" aria-hidden="true">
          <span>01</span><i className={stage >= 0 ? "is-active" : ""} />
          <span>02</span><i className={stage >= 1 ? "is-active" : ""} />
          <span>03</span>
        </div>
        <div className="composer__body">
          <div className="composer__topline">
            <div>
              <p className="object-label">{stage === 0 ? "Their names" : stage === 1 ? "Your words" : "Seal the story"}</p>
              <h2 id="composer-title">{templateNames[templateId]}</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close creator">×</button>
          </div>

          <form onSubmit={handleSubmit}>
            {stage === 0 && (
              <div className="question-stack">
                <label>
                  <span>Who is this for?</span>
                  <input autoFocus required minLength={1} maxLength={60} value={form.toName} onChange={(event) => update("toName", event.target.value)} placeholder="Their name" />
                </label>
                <label>
                  <span>Who is it from?</span>
                  <input required minLength={1} maxLength={60} value={form.fromName} onChange={(event) => update("fromName", event.target.value)} placeholder="Your name" />
                </label>
                <p className="field-note">No account first. No public profile. Just the two names this story needs.</p>
              </div>
            )}

            {stage === 1 && templateId === "celebrating" && (
              <div className="question-stack">
                <label>
                  <span>What are we celebrating?</span>
                  <select value={form.occasion} onChange={(event) => update("occasion", event.target.value)}>
                    <option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="graduation">Graduation</option><option value="achievement">Achievement</option><option value="reunion">Reunion</option><option value="just-because">Just because</option><option value="custom">Custom</option>
                  </select>
                </label>
                {form.occasion === "custom" && <label><span>What should the occasion be called?</span><input required maxLength={80} value={form.customOccasionLabel} onChange={(event) => update("customOccasionLabel", event.target.value)} /></label>}
                <label><span>What do you most want them to feel celebrated for?</span><textarea required minLength={8} maxLength={240} rows={3} value={form.spotlight} onChange={(event) => update("spotlight", event.target.value)} /></label>
                <label><span>What would you say if you had this whole evening?</span><textarea required minLength={30} maxLength={5000} rows={7} value={form.letter} onChange={(event) => update("letter", event.target.value)} /></label>
              </div>
            )}

            {stage === 1 && templateId === "loving" && (
              <div className="question-stack">
                <label><span>What little thing about them stays with you?</span><textarea required minLength={8} maxLength={240} rows={3} value={form.littleThing} onChange={(event) => update("littleThing", event.target.value)} placeholder="A phrase, a habit, a way they care…" /></label>
                <label><span>What do you want them to know about being loved by you?</span><textarea required minLength={30} maxLength={5000} rows={9} value={form.letter} onChange={(event) => update("letter", event.target.value)} /></label>
              </div>
            )}

            {stage === 1 && templateId === "sorry" && (
              <div className="question-stack question-stack--dense">
                <label><span>What are you apologizing for?</span><textarea required minLength={15} maxLength={600} rows={3} value={form.whatHappened} onChange={(event) => update("whatHappened", event.target.value)} /></label>
                <label><span>What responsibility are you taking?</span><textarea required minLength={15} maxLength={600} rows={3} value={form.responsibility} onChange={(event) => update("responsibility", event.target.value)} /></label>
                <label><span>What impact do you understand?</span><textarea required minLength={15} maxLength={600} rows={3} value={form.impact} onChange={(event) => update("impact", event.target.value)} /></label>
                <label><span>What will you do differently?</span><textarea required minLength={15} maxLength={600} rows={3} value={form.repairStep} onChange={(event) => update("repairStep", event.target.value)} /></label>
                <label><span>Close without asking for forgiveness.</span><textarea required minLength={10} maxLength={1500} rows={4} value={form.closing} onChange={(event) => update("closing", event.target.value)} /></label>
              </div>
            )}

            {stage === 2 && (
              <div className="review-sheet">
                <p className="object-label">Private story for</p>
                <h3>{form.toName}</h3>
                <p>From {form.fromName}</p>
                <div className="review-sheet__rule" />
                <p>{templateId === "celebrating" ? form.spotlight : templateId === "loving" ? form.littleThing : form.whatHappened}</p>
                <div className="price-line"><span>One private Pooklet</span><strong>₹10</strong></div>
                <p className="field-note">Your order opens in Razorpay secure checkout. A signed server response publishes the private link automatically.</p>
              </div>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="composer__actions">
              {stage > 0 && <button className="button button--quiet" type="button" onClick={() => setStage((current) => current - 1)}>Back</button>}
              <button className="button button--ink" type="submit" disabled={submitting}>{submitting ? "Preparing your order…" : stage === 2 ? "Create ₹10 order" : "Continue"}</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
