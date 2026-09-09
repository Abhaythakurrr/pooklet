import type { GiftDraft } from "@pooklet/domain";

type CelebrationGift = Extract<GiftDraft, { templateId: "celebrating" }>;

const occasionNames: Record<CelebrationGift["occasion"], string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  graduation: "Graduation",
  achievement: "An achievement",
  reunion: "Together again",
  "just-because": "Just because",
  custom: "A moment worth celebrating",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

export function CelebratingGift({
  gift,
  onReturnCover,
}: {
  gift: CelebrationGift;
  onReturnCover: () => void;
}) {
  const occasion = gift.customOccasionLabel ?? occasionNames[gift.occasion];
  const dedicationHeading = gift.occasion === "anniversary" ? "Tonight is for us." : "Tonight is for you.";

  return (
    <main className="recipient-site celebration-site">
      <a className="recipient-skip" href="#celebration-main">Skip to the dedication</a>
      <header className="celebration-nav">
        <a href="#celebration-top" className="celebration-nav__brand">Pooklet <span>after dark</span></a>
        <nav aria-label="Celebration sections">
          <a href="#celebration-main">Dedication</a>
          {gift.memories.length > 0 && <a href="#celebration-memories">Memories</a>}
          <a href="#celebration-letter">Letter</a>
        </nav>
        <button type="button" onClick={onReturnCover}>Invitation</button>
      </header>

      <section className="celebration-hero" id="celebration-top" aria-labelledby="celebration-title">
        <div className="celebration-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="celebration-hero__occasion">
          <span>{occasion}</span>
          {gift.occasionDate && <time dateTime={gift.occasionDate}>{displayDate(gift.occasionDate)}</time>}
        </div>
        <div className="celebration-hero__copy">
          <p>A private rooftop prepared by {gift.fromName}</p>
          <h1 id="celebration-title">A night with <em>{gift.toName}</em> written above the city.</h1>
          <a href="#celebration-main">Step onto the rooftop <span aria-hidden="true">↓</span></a>
        </div>
        <div className="celebration-horizon" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="celebration-dedication" id="celebration-main" aria-labelledby="dedication-title">
        <div className="celebration-dedication__index"><span>01</span><p>The reason for tonight</p></div>
        <div className="celebration-dedication__copy">
          <p className="celebration-overline">{occasion}</p>
          <h2 id="dedication-title">{dedicationHeading}</h2>
          <p>{gift.spotlight}</p>
          {gift.anniversaryYears && <small>{gift.anniversaryYears} years, kept here with care.</small>}
        </div>
        <div className="celebration-light-string" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </section>

      {gift.memories.length > 0 && (
        <section className="celebration-memories" id="celebration-memories" aria-labelledby="celebration-memories-title">
          <header>
            <p>02 · The lights that brought us here</p>
            <h2 id="celebration-memories-title">A few moments worth bringing into tonight.</h2>
          </header>
          <ol>
            {gift.memories.map((memory, index) => (
              <li key={memory.id}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <article>
                  <p>{memory.date ?? "A light in the skyline"}</p>
                  <h3>{memory.title}</h3>
                  <div>{memory.text}</div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      )}

      {gift.wish && (
        <section className="celebration-wish" aria-labelledby="celebration-wish-title">
          <p>For what comes next</p>
          <h2 id="celebration-wish-title">One wish, folded into the evening.</h2>
          <blockquote>{gift.wish}</blockquote>
        </section>
      )}

      <section className="celebration-letter" id="celebration-letter" aria-labelledby="celebration-letter-title">
        <div className="celebration-table" aria-hidden="true"><i /><i /><i /></div>
        <article>
          <p className="celebration-overline">The letter at the center of the table</p>
          <h2 id="celebration-letter-title">{gift.toName},</h2>
          <div className="recipient-letter-copy">{gift.letter}</div>
          <p className="recipient-signature">With love,<br /><strong>{gift.fromName}</strong></p>
        </article>
      </section>

      <footer className="celebration-footer">
        <p>Stay a little. This moment is yours.</p>
        <div><a href="#celebration-top">Return to the skyline</a><button type="button" onClick={onReturnCover}>Close to invitation</button></div>
      </footer>
    </main>
  );
}
