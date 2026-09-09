import { giftDraftSchema, type GiftDraft, type TemplateId } from "@pooklet/domain";

export type ConversationStep =
  | "choose_template"
  | "to_name"
  | "from_name"
  | "celebration_occasion"
  | "celebration_spotlight"
  | "celebration_letter"
  | "loving_little_thing"
  | "loving_letter"
  | "sorry_happened"
  | "sorry_responsibility"
  | "sorry_impact"
  | "sorry_repair"
  | "sorry_closing"
  | "confirm"
  | "awaiting_payment";

export type ConversationSession = {
  step: ConversationStep;
  templateId?: TemplateId;
  fields: Record<string, string>;
  orderId?: string;
  invitationDeliveredAt?: string;
};

export type ConversationResult = {
  session: ConversationSession;
  replies: string[];
  completedGift?: GiftDraft;
};

const chooseTemplateCopy =
  "What would you like them to feel?\n\n1 — Celebrated\n2 — Loved in the little things\n3 — A careful, honest apology\n\nReply 1, 2, or 3. You can type CANCEL at any time.";

export function newConversation(): ConversationSession {
  return { step: "choose_template", fields: {} };
}

function retry(session: ConversationSession, message: string): ConversationResult {
  return { session, replies: [message] };
}

function validLength(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum;
}

function templateFromText(text: string): TemplateId | undefined {
  const normalized = text.toLowerCase();
  if (["1", "celebrate", "celebrating", "celebration"].includes(normalized)) return "celebrating";
  if (["2", "love", "loving"].includes(normalized)) return "loving";
  if (["3", "sorry", "apology", "apologize", "apologise"].includes(normalized)) return "sorry";
  return undefined;
}

function occasionFromText(text: string) {
  const normalized = text.toLowerCase().replaceAll(" ", "-");
  const occasions = [
    "birthday",
    "anniversary",
    "graduation",
    "achievement",
    "reunion",
    "just-because",
    "custom",
  ] as const;
  return occasions.find((occasion) => occasion === normalized);
}

function nextAfterNames(session: ConversationSession): ConversationResult {
  if (session.templateId === "celebrating") {
    return {
      session: { ...session, step: "celebration_occasion" },
      replies: [
        "What are we celebrating? Reply: birthday, anniversary, graduation, achievement, reunion, just because, or custom.",
      ],
    };
  }
  if (session.templateId === "loving") {
    return {
      session: { ...session, step: "loving_little_thing" },
      replies: ["What is one little thing about them that stays with you? (8–240 characters)"],
    };
  }
  return {
    session: { ...session, step: "sorry_happened" },
    replies: ["What are you apologizing for? Name the specific action without explaining it away."],
  };
}

function buildGift(session: ConversationSession): GiftDraft {
  const base = {
    toName: session.fields.toName,
    fromName: session.fields.fromName,
  };
  if (session.templateId === "celebrating") {
    return giftDraftSchema.parse({
      ...base,
      templateId: "celebrating",
      occasion: session.fields.occasion,
      customOccasionLabel:
        session.fields.occasion === "custom" ? "A moment worth celebrating" : undefined,
      spotlight: session.fields.spotlight,
      memories: [],
      letter: session.fields.letter,
    });
  }
  if (session.templateId === "loving") {
    return giftDraftSchema.parse({
      ...base,
      templateId: "loving",
      littleThings: [session.fields.littleThing],
      memories: [],
      letter: session.fields.letter,
    });
  }
  return giftDraftSchema.parse({
    ...base,
    templateId: "sorry",
    whatHappened: session.fields.whatHappened,
    responsibility: session.fields.responsibility,
    impact: session.fields.impact,
    repairStep: session.fields.repairStep,
    closing: session.fields.closing,
    boundaryNote: "You do not need to reply before you are ready.",
    memories: [],
  });
}

export function advanceConversation(
  current: ConversationSession | undefined,
  incomingText: string,
): ConversationResult {
  const text = incomingText.trim();
  const command = text.toLowerCase();
  if (!current || ["start", "/start", "create", "restart"].includes(command)) {
    return { session: newConversation(), replies: [chooseTemplateCopy] };
  }
  if (command === "cancel") {
    return {
      session: newConversation(),
      replies: ["Nothing was published. When you are ready, reply START."],
    };
  }
  if (command === "help") {
    return {
      session: current,
      replies: ["Reply with the answer to the current question. Type RESTART to begin again or CANCEL to stop."],
    };
  }
  if (!text) return retry(current, "Please send a written answer, or type CANCEL.");

  switch (current.step) {
    case "choose_template": {
      const templateId = templateFromText(text);
      if (!templateId) return retry(current, "Please reply 1, 2, or 3 so I know which feeling to make.");
      return {
        session: { step: "to_name", templateId, fields: {} },
        replies: ["Who is this for? Send their name."],
      };
    }
    case "to_name":
      if (!validLength(text, 1, 60)) return retry(current, "Use a name between 1 and 60 characters.");
      return {
        session: { ...current, step: "from_name", fields: { ...current.fields, toName: text } },
        replies: ["Who is it from? Send your name."],
      };
    case "from_name": {
      if (!validLength(text, 1, 60)) return retry(current, "Use a name between 1 and 60 characters.");
      return nextAfterNames({ ...current, fields: { ...current.fields, fromName: text } });
    }
    case "celebration_occasion": {
      const occasion = occasionFromText(text);
      if (!occasion) return retry(current, "Choose birthday, anniversary, graduation, achievement, reunion, just because, or custom.");
      return {
        session: {
          ...current,
          step: "celebration_spotlight",
          fields: { ...current.fields, occasion },
        },
        replies: ["What do you most want them to feel celebrated for? (8–240 characters)"],
      };
    }
    case "celebration_spotlight":
      if (!validLength(text, 8, 240)) return retry(current, "Please write between 8 and 240 characters.");
      return {
        session: {
          ...current,
          step: "celebration_letter",
          fields: { ...current.fields, spotlight: text },
        },
        replies: ["Write the letter waiting at the center of their evening. (30–5,000 characters)"],
      };
    case "celebration_letter":
    case "loving_letter":
      if (!validLength(text, 30, 5_000)) return retry(current, "The letter needs 30–5,000 characters. Take all the room you need.");
      return {
        session: { ...current, step: "confirm", fields: { ...current.fields, letter: text } },
        replies: ["Your words are ready. Publishing costs ₹10. Reply PAY to create the order, or RESTART to begin again."],
      };
    case "loving_little_thing":
      if (!validLength(text, 8, 240)) return retry(current, "Please write between 8 and 240 characters.");
      return {
        session: {
          ...current,
          step: "loving_letter",
          fields: { ...current.fields, littleThing: text },
        },
        replies: ["What do you want them to know about being loved by you? (30–5,000 characters)"],
      };
    case "sorry_happened":
      if (!validLength(text, 15, 600)) return retry(current, "Please be specific in 15–600 characters.");
      return {
        session: {
          ...current,
          step: "sorry_responsibility",
          fields: { ...current.fields, whatHappened: text },
        },
        replies: ["What responsibility are you taking, without explaining it away?"],
      };
    case "sorry_responsibility":
      if (!validLength(text, 15, 600)) return retry(current, "Please write between 15 and 600 characters.");
      return {
        session: {
          ...current,
          step: "sorry_impact",
          fields: { ...current.fields, responsibility: text },
        },
        replies: ["What do you understand about how this may have affected them? Leave room for their experience to differ."],
      };
    case "sorry_impact":
      if (!validLength(text, 15, 600)) return retry(current, "Please write between 15 and 600 characters.");
      return {
        session: { ...current, step: "sorry_repair", fields: { ...current.fields, impact: text } },
        replies: ["What will you do differently that is concrete and within your control?"],
      };
    case "sorry_repair":
      if (!validLength(text, 15, 600)) return retry(current, "Please write between 15 and 600 characters.");
      return {
        session: { ...current, step: "sorry_closing", fields: { ...current.fields, repairStep: text } },
        replies: ["Close without asking them to respond, reassure you, or forgive you. (10–1,500 characters)"],
      };
    case "sorry_closing":
      if (!validLength(text, 10, 1_500)) return retry(current, "Please write between 10 and 1,500 characters.");
      return {
        session: { ...current, step: "confirm", fields: { ...current.fields, closing: text } },
        replies: ["Your careful letter is ready. Publishing costs ₹10. Reply PAY to create the order, or RESTART to begin again."],
      };
    case "confirm":
      if (!["pay", "seal"].includes(command)) return retry(current, "Reply PAY to create the ₹10 order, or RESTART.");
      return { session: current, replies: [], completedGift: buildGift(current) };
    case "awaiting_payment":
      return retry(current, "Open the secure checkout link, or type STATUS to check payment confirmation.");
  }
}
