import { z } from "zod";

export const WordPairSchema = z.object({
  commonWord: z.string().min(1).max(20),
  undercoverWord: z.string().min(1).max(20),
  category: z.string().min(1).max(30),
  sceneIntro: z.string().min(10).max(220),
});

export const AiActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  word: z.string().min(1).optional(),
  persona: z
    .object({
      label: z.string().min(1),
      speakingStyle: z.string().min(1),
      catchphrases: z.array(z.string().min(1)).min(1),
      reasoningStyle: z.string().min(1),
      votingBias: z.string().min(1),
    })
    .optional(),
});

export const CandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const AiActionRequestSchema = z.object({
  action: z.enum(["phase1Speech", "phase1Vote", "phase2Defense", "phase2Vote"]),
  locale: z.enum(["zh-CN", "en-US"]),
  actor: AiActorSchema,
  candidates: z.array(CandidateSchema).min(1),
  context: z.unknown(),
});

export const Phase1SpeechSchema = z.object({
  speech: z.string().min(4).max(160),
});

export const Phase1VoteSchema = z
  .object({
    targetId: z.string().min(1),
  })
  .strict();

export const Phase2VoteSchema = z.object({
  targetId: z.string().min(1),
  reason: z.string().min(4).max(180),
});

export const VoteActionSchema = Phase2VoteSchema;

export const Phase2DefenseSchema = z.object({
  claim: z.string().min(8).max(260),
  suspicionTargetId: z.string().min(1),
  suspicionReason: z.string().min(8).max(220),
  contextAnchors: z.array(z.string().min(2).max(80)).min(1),
});

export const AiActionResponseSchema = z.union([
  Phase1SpeechSchema,
  Phase1VoteSchema,
  VoteActionSchema,
  Phase2DefenseSchema,
]);

export type WordPairOutput = z.infer<typeof WordPairSchema>;
export type AiActionRequest = z.infer<typeof AiActionRequestSchema>;
export type Phase1SpeechOutput = z.infer<typeof Phase1SpeechSchema>;
export type Phase1VoteOutput = z.infer<typeof Phase1VoteSchema>;
export type Phase2VoteOutput = z.infer<typeof Phase2VoteSchema>;
export type VoteActionOutput = Phase2VoteOutput;
export type Phase2DefenseOutput = z.infer<typeof Phase2DefenseSchema>;
export type AiActionResponse = z.infer<typeof AiActionResponseSchema>;

export function parseModelJson<T>(content: string, schema: z.ZodType<T>): T {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("MODEL_JSON_NOT_FOUND");
  }

  const jsonText = withoutFence.slice(firstBrace, lastBrace + 1);
  return schema.parse(JSON.parse(jsonText));
}

export function responseSchemaForAction(
  action: AiActionRequest["action"],
): z.ZodType<AiActionResponse> {
  if (action === "phase1Speech") {
    return Phase1SpeechSchema as z.ZodType<AiActionResponse>;
  }

  if (action === "phase2Defense") {
    return Phase2DefenseSchema as z.ZodType<AiActionResponse>;
  }

  if (action === "phase1Vote") {
    return Phase1VoteSchema as z.ZodType<AiActionResponse>;
  }

  return Phase2VoteSchema as z.ZodType<AiActionResponse>;
}
