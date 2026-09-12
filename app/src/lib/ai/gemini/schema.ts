import { z } from 'zod';

export const NO_GROUNDED_ANSWER = "I don't have enough data to answer that reliably.";

const ctaSchema = z.object({
  label: z.string(),
  route: z.object({
    screen: z.enum(['overview', 'branches', 'branch', 'reps', 'rep', 'actions', 'funnel', 'compare']),
    branchId: z.string().optional(),
    repId: z.string().optional(),
    tier: z.string().optional(),
  }),
}).nullable().optional();

export const groundedAnswerSchema = z.object({
  answer: z.string(),
  evidence: z.array(z.object({
    metric: z.string(),
    value: z.string(),
    context: z.string().optional().default(''),
  })).default([]),
  impact: z.string().default(''),
  recommendation: z.string().default(''),
  citations: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  cta: ctaSchema,
});

export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>;

export const GROUNDED_ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          value: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['metric', 'value'],
      },
    },
    impact: { type: 'string', description: "The business consequence of the fact stated in 'answer' (e.g. revenue/units at risk) — empty only if there is no clear business impact to state." },
    recommendation: {
      type: 'string',
      description:
        "A concrete, specific next action the user should take. REQUIRED (must not be empty) whenever the question asks what to do, how to fix something, or what the user should act on next (e.g. 'What should I do?', 'How do I fix this?') — never leave this blank for an action-seeking question just because the answer text already narrates the situation. Optional/empty only for purely descriptive questions with no actionable next step.",
    },
    citations: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    cta: {
      type: ['object', 'null'],
      properties: {
        label: { type: 'string' },
        route: {
          type: 'object',
          properties: {
            screen: { type: 'string', enum: ['overview', 'branches', 'branch', 'reps', 'rep', 'actions', 'funnel', 'compare'] },
            branchId: { type: 'string' },
            repId: { type: 'string' },
            tier: { type: 'string' },
          },
          required: ['screen'],
        },
      },
      required: ['label', 'route'],
    },
  },
  required: ['answer'],
};

export function safeFallback(): GroundedAnswer {
  return {
    answer: NO_GROUNDED_ANSWER,
    evidence: [],
    impact: '',
    recommendation: '',
    citations: [],
    confidence: 'low',
  };
}
