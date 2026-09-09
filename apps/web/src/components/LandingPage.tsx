import { lazy, Suspense, useEffect, useState } from "react";
import type { TemplateId } from "@pooklet/domain";
import { Composer } from "./Composer";

const DreamScene = lazy(() => import("./DreamScene"));

const templates: Array<{
  id: TemplateId;
  number: string;
  title: string;
  description: string;
}> = [
  { id: "celebrating", number: "01", title: "Celebrating", description: "A little world for their big moment." },
  { id: "loving", number: "02", title: "Loving", description: "For everything you feel in the ordinary moments." },
  { id: "sorry", number: "03", title: "I am sorry", description: "For words that need honesty, care, and room." },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setReduced(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return [reduced, setReduced] as const;
}

export function LandingPage() {
  const [selected, setSelected] = useState<TemplateId>();
  const [reducedMotion, setReducedMotion] = useReducedMotion();

  return (
    <main className="landing">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pooklet home"><span className="brand__mark">P</span><span>Pooklet</span></a>
        <nav aria-label="Main navigation">
          <a href="#feelings">Feelings</a><a href="#how">How it works</a>
          <button className="motion-toggle" type="button" onClick={() => setReducedMotion((value) => !value)} aria-pressed={reducedMotion}>{reducedMotion ? "Motion off" : "Less motion"}</button>
        </nav>
        <a className="topbar__make" href="#feelings">Make one <span>₹10</span></a>
      </header>

      <section className="hero">
        <div className="hero__atmosphere" />
        <Suspense fallback={null}><DreamScene reducedMotion={reducedMotion} /></Suspense>
        <div className="hero__content">
          <p className="eyebrow"><span /> A private place for honest words</p>
          <h1>Some feelings<br />deserve a world<br /><em>of their own.</em></h1>
          <p className="hero__lede">Turn your words into a tiny, private experience they can open at their own pace. No feed. No public post. Just something made for them.</p>
          <div className="hero__actions">
            <a className="button button--ink" href="#feelings">Choose a feeling</a>
            <span className="hero__price"><b>₹10</b><small>one story · private link</small></span>
          </div>
        </div>
        <p className="hero__scene-note">A letter waiting above the clouds <span>↓</span></p>
      </section>

      <section className="feelings" id="feelings">
        <div className="section-intro"><p className="object-label">Three ways to say what matters</p><h2>What would you like<br />them to feel?</h2><p>Choose first. We will only ask the questions that belong to that feeling.</p></div>
        <div className="template-grid">
          {templates.map((template) => (
            <button className={`template-card template-card--${template.id}`} key={template.id} type="button" onClick={() => setSelected(template.id)}>
              <span className="template-card__number">{template.number}</span>
              <span className="template-card__scene" aria-hidden="true">
                {template.id === "celebrating" && <span className="mini-rooftop"><i /><b>YOUR NIGHT</b><i /></span>}
                {template.id === "loving" && <span className="mini-window"><i className="mini-window__moon" /><i className="mini-window__cassette" /></span>}
                {template.id === "sorry" && <span className="mini-rain"><i /><i /><i /><b /></span>}
              </span>
              <span className="template-card__copy"><strong>{template.title}</strong><span>{template.description}</span></span>
              <span className="template-card__action">Choose this feeling <i>↗</i></span>
            </button>
          ))}
        </div>
      </section>

      <section className="how" id="how">
        <div className="how__visual" aria-hidden="true"><div className="paper-stack"><span>For the words<br />that matter</span><i /></div></div>
        <div className="how__copy"><p className="object-label">Made slowly. Opened gently.</p><h2>A beginning,<br />not a dashboard.</h2><ol><li><span>01</span><div><strong>Choose the feeling</strong><p>Celebration, everyday love, or a careful apology.</p></div></li><li><span>02</span><div><strong>Put your words inside</strong><p>Answer a few thoughtful prompts. A text-only story is complete.</p></div></li><li><span>03</span><div><strong>Pay ₹10 securely</strong><p>Razorpay verifies the payment automatically, then your private invitation is ready.</p></div></li></ol></div>
      </section>

      <section className="channels">
        <p className="object-label">Make it here or make it in chat</p><h2>Web to compose.<br />Telegram to deliver.</h2><p className="channels__lede">Use the full web creator or let the Telegram bot guide each answer. After Razorpay verifies the ₹10 payment, the same Telegram chat receives a private cute link and a recipient QR—without scraping, cold DMs, or a messaging aggregator.</p>
        <div className="channel-line"><span>WEB CREATOR</span><span>TELEGRAM BOT</span><span>₹10 CHECKOUT</span><span>PRIVATE LINK + QR</span></div>
      </section>

      <footer><a className="brand" href="/"><span className="brand__mark">P</span><span>Pooklet</span></a><p>The environment carries the feeling.<br />Your words make it true.</p><a href="#feelings">Make one for ₹10 ↑</a></footer>
      {selected && <Composer templateId={selected} onClose={() => setSelected(undefined)} />}
    </main>
  );
}
