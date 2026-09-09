import { useEffect, useState } from "react";
import type { StorySnapshot } from "@pooklet/domain";
import { getInvitation, getInvitationBySlug } from "../api";
import { CelebratingGift } from "./gifts/CelebratingGift";
import { GiftCover } from "./gifts/GiftCover";
import { LovingGift } from "./gifts/LovingGift";
import { SorryGift } from "./gifts/SorryGift";

export function GiftPage({ token, slug }: { token?: string; slug?: string }) {
  const [story, setStory] = useState<StorySnapshot>();
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive";
    document.head.append(robots);
    let active = true;

    const request = slug ? getInvitationBySlug(slug) : getInvitation(token ?? "");
    void request
      .then((nextStory) => {
        if (!active) return;
        setStory(nextStory);
        document.title = `A private Pooklet for ${nextStory.gift.toName}`;
      })
      .catch(() => {
        if (active) setError("This private invitation is unavailable.");
      });

    return () => {
      active = false;
      robots.remove();
      document.title = previousTitle;
    };
  }, [slug, token]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [opened]);

  if (error) {
    return (
      <main className="gift-unavailable">
        <div>
          <p className="object-label">Private invitation</p>
          <h1>This page is unavailable.</h1>
          <p>The link may be incomplete or no longer active.</p>
        </div>
      </main>
    );
  }

  if (!story) {
    return (
      <main className="gift-unavailable" aria-live="polite">
        <p className="loading-line">Opening the envelope…</p>
      </main>
    );
  }

  if (!opened) {
    return <GiftCover gift={story.gift} onOpen={() => setOpened(true)} />;
  }

  const returnToCover = () => setOpened(false);
  switch (story.gift.templateId) {
    case "celebrating":
      return <CelebratingGift gift={story.gift} onReturnCover={returnToCover} />;
    case "loving":
      return <LovingGift gift={story.gift} onReturnCover={returnToCover} />;
    case "sorry":
      return <SorryGift gift={story.gift} onReturnCover={returnToCover} />;
  }
}
