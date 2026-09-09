import { useState } from "react";
import type { GiftDraft } from "@pooklet/domain";

type GiftCoverProps = {
  gift: GiftDraft;
  onOpen: () => void;
};

export function GiftCover({ gift, onOpen }: GiftCoverProps) {
  const [waiting, setWaiting] = useState(false);

  if (gift.templateId === "sorry" && waiting) {
    return (
      <main className="recipient-cover recipient-cover--sorry recipient-cover--waiting">
        <section aria-labelledby="waiting-title">
          <p className="recipient-cover__kicker">No action needed</p>
          <h1 id="waiting-title">The letter will wait here.</h1>
          <p>You can close this page and return to the same private link whenever you choose.</p>
          <button className="recipient-cover__secondary" type="button" onClick={() => setWaiting(false)}>
            Return to the envelope
          </button>
        </section>
      </main>
    );
  }

  const opening =
    gift.templateId === "celebrating"
      ? `${gift.toName}, a little night has been made for you.`
      : gift.templateId === "loving"
        ? `${gift.toName}, you have a place in my everyday.`
        : `${gift.toName}, I have something I want to say carefully.`;

  return (
    <main className={`recipient-cover recipient-cover--${gift.templateId}`}>
      <div className="recipient-cover__scene" aria-hidden="true">
        {gift.templateId === "celebrating" && (
          <div className="cover-rooftop">
            <i /><i /><i /><i /><i />
            <b>{gift.toName}</b>
          </div>
        )}
        {gift.templateId === "loving" && (
          <div className="cover-room">
            <div className="cover-room__window"><i /></div>
            <div className="cover-room__lamp" />
            <div className="cover-room__note">for you</div>
          </div>
        )}
        {gift.templateId === "sorry" && (
          <div className="cover-desk">
            <div className="cover-desk__rain"><i /><i /><i /><i /></div>
            <div className="cover-desk__envelope"><i /></div>
          </div>
        )}
      </div>

      <section aria-labelledby="cover-title">
        <p className="recipient-cover__kicker">A private Pooklet · from {gift.fromName}</p>
        <h1 id="cover-title">{opening}</h1>
        <p className="recipient-cover__from">Only someone with this link can open it.</p>
        <div className="recipient-cover__actions">
          <button className="recipient-cover__primary" type="button" onClick={onOpen}>
            {gift.templateId === "sorry" ? "Read the letter" : gift.templateId === "loving" ? "Come a little closer" : "Open your invitation"}
          </button>
          {gift.templateId === "sorry" && (
            <button className="recipient-cover__secondary" type="button" onClick={() => setWaiting(true)}>
              Not right now
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
