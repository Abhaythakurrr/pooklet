import type { GiftDraft } from "@pooklet/domain";

type LovingGiftData = Extract<GiftDraft, { templateId: "loving" }>;

export function LovingGift({
  gift,
  onReturnCover,
}: {
  gift: LovingGiftData;
  onReturnCover: () => void;
}) {
  return (
    <main className="recipient-site loving-site">
      <a className="recipient-skip" href="#loving-notes">Skip to the little things</a>
      <header className="loving-nav">
        <a href="#loving-top" className="loving-nav__brand"><span>Pooklet</span>The house of little things</a>
        <nav aria-label="Love letter sections">
          <a href="#loving-notes">Little things</a>
          {gift.memories.length > 0 && <a href="#loving-memories">Memories</a>}
          <a href="#loving-letter">Letter</a>
        </nav>
        <button type="button" onClick={onReturnCover}>Front window</button>
      </header>

      <section className="loving-hero" id="loving-top" aria-labelledby="loving-title">
        <div className="loving-hero__copy">
          <p>Made with love by {gift.fromName}</p>
          <h1 id="loving-title">You have a place in my <em>everyday,</em> {gift.toName}.</h1>
          <p>Not only in the grand moments. In the ordinary ones that quietly become a life.</p>
          <a href="#loving-notes">Come inside <span aria-hidden="true">→</span></a>
        </div>
        <div className="loving-room" aria-hidden="true">
          <div className="loving-room__window"><i /><b /></div>
          <div className="loving-room__shelf"><i /><i /><i /></div>
          <div className="loving-room__chair" />
          <div className="loving-room__rug" />
        </div>
      </section>

      <section className="loving-notes" id="loving-notes" aria-labelledby="loving-notes-title">
        <header>
          <p>Things I notice</p>
          <h2 id="loving-notes-title">It is often the smallest things.</h2>
          <span>{gift.littleThings.length === 1 ? "One detail, kept close." : `${gift.littleThings.length} details, kept close.`}</span>
        </header>
        <ol>
          {gift.littleThings.map((detail, index) => (
            <li key={`${index}-${detail.slice(0, 20)}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {gift.memories.length > 0 && (
        <section className="loving-memories" id="loving-memories" aria-labelledby="loving-memories-title">
          <header>
            <p>From the shelf of us</p>
            <h2 id="loving-memories-title">Nothing extraordinary to anyone else. Everything to me.</h2>
          </header>
          <div className="loving-memory-shelf">
            {gift.memories.map((memory, index) => (
              <article key={memory.id} style={{ "--memory-tilt": `${index % 2 === 0 ? -1.4 : 1.2}deg` } as React.CSSProperties}>
                <span>{memory.date ?? `Memory ${index + 1}`}</span>
                <h3>{memory.title}</h3>
                <p>{memory.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {gift.distanceDetail && (
        <section className="loving-window-note" aria-labelledby="loving-distance-title">
          <div className="loving-window-note__view" aria-hidden="true"><i /></div>
          <article>
            <p>Even when we are apart</p>
            <h2 id="loving-distance-title">The window-side note.</h2>
            <blockquote>{gift.distanceDetail}</blockquote>
          </article>
        </section>
      )}

      {gift.futureWish && (
        <section className="loving-future" aria-labelledby="loving-future-title">
          <div>
            <p>One day, something simple</p>
            <h2 id="loving-future-title">A postcard from a hoped-for ordinary day.</h2>
          </div>
          <blockquote>{gift.futureWish}</blockquote>
        </section>
      )}

      <section className="loving-letter" id="loving-letter" aria-labelledby="loving-letter-title">
        <div className="loving-letter__lamp" aria-hidden="true"><i /></div>
        <article>
          <p>Not just for today</p>
          <h2 id="loving-letter-title">{gift.toName},</h2>
          <div className="recipient-letter-copy">{gift.letter}</div>
          <p className="recipient-signature">With love,<br /><strong>{gift.fromName}</strong></p>
        </article>
      </section>

      <footer className="loving-footer">
        <p>A little place to return to.</p>
        <div><a href="#loving-top">Back to the window</a><button type="button" onClick={onReturnCover}>Close to front window</button></div>
      </footer>
    </main>
  );
}
