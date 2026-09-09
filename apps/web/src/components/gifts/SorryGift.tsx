import type { GiftDraft } from "@pooklet/domain";

type SorryGiftData = Extract<GiftDraft, { templateId: "sorry" }>;

export function SorryGift({
  gift,
  onReturnCover,
}: {
  gift: SorryGiftData;
  onReturnCover: () => void;
}) {
  return (
    <main className="recipient-site apology-site">
      <a className="recipient-skip" href="#apology-letter">Skip to the letter</a>
      <header className="apology-nav">
        <a href="#apology-top"><span>Pooklet</span>A letter beside the rain</a>
        <p>Private · from {gift.fromName}</p>
        <button type="button" onClick={onReturnCover}>Return to cover</button>
      </header>

      <section className="apology-intro" id="apology-top" aria-labelledby="apology-title">
        <div className="apology-intro__rain" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div>
          <p>Read at your own pace</p>
          <h1 id="apology-title">{gift.toName}, this letter asks nothing from you.</h1>
          <p>You can pause, leave, or return to it. Reading it does not require a reply.</p>
          <a href="#apology-letter">Read the letter <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <article className="apology-letter" id="apology-letter" aria-labelledby="apology-letter-title">
        <header>
          <p>A letter from {gift.fromName}</p>
          <h2 id="apology-letter-title">{gift.toName},</h2>
        </header>

        <section aria-labelledby="apology-action-title">
          <p className="apology-letter__label">What I did</p>
          <h3 id="apology-action-title" className="sr-only">What I did</h3>
          <p>{gift.whatHappened}</p>
        </section>

        <section aria-labelledby="apology-responsibility-title">
          <p className="apology-letter__label">The responsibility I am taking</p>
          <h3 id="apology-responsibility-title" className="sr-only">The responsibility I am taking</h3>
          <p>{gift.responsibility}</p>
        </section>

        <section aria-labelledby="apology-impact-title">
          <p className="apology-letter__label">What I understand</p>
          <h3 id="apology-impact-title" className="sr-only">What I understand</h3>
          <p>{gift.impact}</p>
        </section>

        <section aria-labelledby="apology-repair-title">
          <p className="apology-letter__label">What I will change</p>
          <h3 id="apology-repair-title" className="sr-only">What I will change</h3>
          <p>{gift.repairStep}</p>
          {gift.timeframe && <p className="apology-letter__timeframe"><span>Timeframe</span>{gift.timeframe}</p>}
        </section>

        <section aria-labelledby="apology-closing-title">
          <p className="apology-letter__label">What I want to leave with you</p>
          <h3 id="apology-closing-title" className="sr-only">Closing words</h3>
          <p>{gift.closing}</p>
        </section>

        {gift.boundaryNote && <aside>{gift.boundaryNote}</aside>}
        <footer><span>—</span><strong>{gift.fromName}</strong></footer>
      </article>

      {gift.memories.length > 0 && (
        <section className="apology-memories" aria-labelledby="apology-memories-title">
          <header>
            <p>Optional · after the apology</p>
            <h2 id="apology-memories-title">Something gently remembered.</h2>
            <span>These memories are here to read or pass by. They do not ask for an outcome.</span>
          </header>
          <div>
            {gift.memories.map((memory) => (
              <article key={memory.id}>
                <p>{memory.date ?? "A memory"}</p>
                <h3>{memory.title}</h3>
                <div>{memory.text}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="apology-footer">
        <div>
          <p>You can take your time.</p>
          <h2>You do not need to do anything here.</h2>
        </div>
        <div><a href="#apology-letter">Read again</a><button type="button" onClick={onReturnCover}>Return to the cover</button></div>
      </footer>
    </main>
  );
}
