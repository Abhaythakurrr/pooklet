import { z } from "zod";

export const TEMPLATE_IDS = ["celebrating", "loving", "sorry"] as const;
export const templateIdSchema = z.enum(TEMPLATE_IDS);

const nameSchema = z.string().trim().min(1).max(60);
const requiredText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

export const memorySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    title: requiredText(1, 80),
    text: requiredText(1, 400),
    date: optionalText(32),
    assetIds: z.array(z.string().trim().min(1).max(120)).max(2).default([]),
  })
  .strict();

const sharedFields = {
  toName: nameSchema,
  fromName: nameSchema,
};

export const celebrationDraftSchema = z
  .object({
    templateId: z.literal("celebrating"),
    ...sharedFields,
    occasion: z.enum([
      "birthday",
      "anniversary",
      "graduation",
      "achievement",
      "reunion",
      "just-because",
      "custom",
    ]),
    customOccasionLabel: optionalText(80),
    occasionDate: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      ),
    anniversaryYears: z.number().int().positive().max(200).optional(),
    spotlight: requiredText(8, 240),
    wish: optionalText(280),
    memories: z.array(memorySchema).max(8).default([]),
    letter: requiredText(30, 5_000),
  })
  .strict();

export const lovingDraftSchema = z
  .object({
    templateId: z.literal("loving"),
    ...sharedFields,
    littleThings: z.array(requiredText(8, 240)).min(1).max(5),
    distanceDetail: optionalText(400),
    memories: z.array(memorySchema).max(10).default([]),
    futureWish: optionalText(280),
    letter: requiredText(30, 5_000),
  })
  .strict();

export const sorryDraftSchema = z
  .object({
    templateId: z.literal("sorry"),
    ...sharedFields,
    whatHappened: requiredText(15, 600),
    responsibility: requiredText(15, 600),
    impact: requiredText(15, 600),
    repairStep: requiredText(15, 600),
    timeframe: optionalText(120),
    closing: requiredText(10, 1_500),
    boundaryNote: optionalText(400),
    memories: z.array(memorySchema).max(2).default([]),
  })
  .strict();

const draftUnion = z.discriminatedUnion("templateId", [
  celebrationDraftSchema,
  lovingDraftSchema,
  sorryDraftSchema,
]);

export const giftDraftSchema = draftUnion.superRefine((draft, context) => {
  if (
    draft.templateId === "celebrating" &&
    draft.occasion === "custom" &&
    !draft.customOccasionLabel
  ) {
    context.addIssue({
      code: "custom",
      path: ["customOccasionLabel"],
      message: "Name the custom occasion.",
    });
  }
});

export const storySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    createdAt: z.string().datetime(),
    gift: giftDraftSchema,
  })
  .strict();

export type TemplateId = z.infer<typeof templateIdSchema>;
export type Memory = z.infer<typeof memorySchema>;
export type GiftDraft = z.infer<typeof giftDraftSchema>;
export type StorySnapshot = z.infer<typeof storySnapshotSchema>;
