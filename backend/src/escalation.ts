import { openai, CHAT_MODEL } from './openai-client';
import { retrieve } from './retrieval';
import { ChatResponse, LLMDecision } from './types';

// ---------------------------------------------------------------------------
// Tier 1: Rule-based patterns — always escalate, no LLM needed
// Covers: requests for live account data, requests to perform real-world actions
// ---------------------------------------------------------------------------
const ACCOUNT_SPECIFIC_PATTERNS: RegExp[] = [
  // Live account data the documentation cannot supply
  /\bi\s+(was|got|have\s+been)\s+charged\b/i,
  /\bmy\s+(invoice|receipt|transaction|payment\s+history|billing\s+history)\b/i,
  /\bmy\s+(current|active|existing)\s+(plan|subscription)\s+(is|shows|costs|expired|renews)\b/i,
  /\bcharge(?:d)?\s+(incorrectly|wrong|twice|double|duplicate)\b/i,
  // Requested real-world actions
  /\b(cancel|delete|close)\s+(my|our)\s+(account|subscription|workspace|plan)\b/i,
  /\b(issue|give|process|get\s+me)\s+(a|my)\s+refund\b/i,
  /\bi\s+want\s+(a\s+refund|my\s+money\s+back)\b/i,
  // Account state that requires human access
  /\bmy\s+account\s+(is|was|got|has\s+been)\s+(suspended|disabled|banned|locked|deleted|compromised)\b/i,
  /\blocked\s+out\s+of\s+(my\s+)?(account|workspace)\b/i,
];

function checkAccountSpecificPatterns(question: string): { shouldEscalate: boolean; reason: string } {
  for (const pattern of ACCOUNT_SPECIFIC_PATTERNS) {
    if (pattern.test(question)) {
      return {
        shouldEscalate: true,
        reason: 'Question requires live account access or a real-world action that only a human agent can perform.',
      };
    }
  }
  return { shouldEscalate: false, reason: '' };
}

// ---------------------------------------------------------------------------
// Tier 3: LLM structured reasoning
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a customer support AI for TaskFlow, a project management SaaS.
You will be given a customer question and relevant excerpts from the TaskFlow help documentation.

Your job: decide whether to answer the question or escalate to a human agent.

ESCALATE when any of the following are true:
1. The provided context does not fully cover the question — partial answers are worse than honest escalation
2. The question requires live account-specific data (current plan status, specific charges, usage details, account history)
3. The question asks you to perform an action (cancel subscription, process refund, reset a password manually)
4. You cannot ground your entire answer in the provided context alone
5. The question is not about TaskFlow or is completely off-topic
6. The question involves a complaint, billing dispute, or emotionally sensitive issue needing human empathy

ANSWER when ALL of the following are true:
1. The context fully and directly addresses the question
2. You can give a complete, accurate answer using ONLY the provided context
3. The question is a general how-to or factual question that the documentation covers

IMPORTANT RULES:
- Do NOT use any knowledge outside the provided context excerpts
- Do NOT guess or infer information not explicitly stated in the context
- When in doubt, escalate — an unnecessary escalation is far less damaging than a wrong answer

Respond with valid JSON only. No markdown code fences, no text outside the JSON object.

Required JSON format:
{
  "can_answer": true or false,
  "confidence": a number from 0.0 to 1.0,
  "answer": "your complete answer here (friendly support-agent tone, only when can_answer is true)",
  "escalation_reason": "brief reason for escalating (only when can_answer is false)"
}

Confidence scale:
- 0.85–1.0: Question is directly and completely answered by the context
- 0.65–0.84: Well covered with only minor gaps
- 0.45–0.64: Partially covered with meaningful uncertainty
- Below 0.45: Significant gaps or off-topic — set can_answer to false`;

async function getLLMDecision(question: string, context: string): Promise<LLMDecision> {
  const userMessage = `Customer question: ${question}

Help documentation context:
${context}

Respond with JSON only.`;

  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1, // Low temperature for consistent, grounded decisions
  });

  const raw = response.choices[0].message.content ?? '{}';

  try {
    const parsed = JSON.parse(raw) as Partial<LLMDecision>;
    return {
      can_answer: parsed.can_answer ?? false,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
      answer: parsed.answer ?? '',
      escalation_reason: parsed.escalation_reason ?? 'Insufficient information to answer reliably.',
    };
  } catch {
    // JSON parse failure → safe escalation
    return {
      can_answer: false,
      confidence: 0,
      answer: '',
      escalation_reason: 'Could not process response reliably. Routing to a human agent.',
    };
  }
}

function buildEscalationMessage(reason: string): string {
  const isAccountRelated = /account|subscription|charge|billing|payment|cancel/i.test(reason);
  if (isAccountRelated) {
    return "I'd be happy to help, but this requires access to your specific account details. I'm connecting you with a human agent who can look into this directly for you.";
  }
  return "I want to make sure you get the most accurate help possible. I'm connecting you with a human agent who'll have the full context to assist you. They'll follow up shortly.";
}

// ---------------------------------------------------------------------------
// Main handler — runs all four tiers
// ---------------------------------------------------------------------------
export async function handleChat(question: string): Promise<ChatResponse> {
  // ── Tier 1: Rule-based account-specific detection (fast, pre-LLM) ──────
  const tier1 = checkAccountSpecificPatterns(question);
  if (tier1.shouldEscalate) {
    return {
      type: 'escalation',
      message: "I'd be happy to help, but this requires access to your specific account details. I'm connecting you with a human agent who can look into this directly for you.",
      confidence: 0.97,
      reasoning: `Tier 1 (rule-based): ${tier1.reason}`,
      retrievedArticles: [],
    };
  }

  // ── Tier 2: Retrieval quality gate ─────────────────────────────────────
  const results = await retrieve(question, 3);
  const maxScore = results.length > 0 ? Math.max(...results.map(r => r.score)) : 0;
  const uniqueArticles = [...new Set(results.map(r => r.chunk.articleTitle))];

  if (maxScore < 0.25) {
    return {
      type: 'escalation',
      message: "I'm not sure I have the right information to help with that. Let me connect you with a human agent who can better assist you.",
      confidence: 0.92,
      reasoning: `Tier 2 (retrieval gate): No relevant documentation found (max similarity: ${maxScore.toFixed(3)}). Question appears outside the TaskFlow knowledge base.`,
      retrievedArticles: [],
    };
  }

  // ── Tier 3: LLM structured reasoning ───────────────────────────────────
  const context = results
    .map(r => `[${r.chunk.articleTitle}]\n${r.chunk.text}`)
    .join('\n\n---\n\n');

  let llmDecision: LLMDecision;
  try {
    llmDecision = await getLLMDecision(question, context);
  } catch (err) {
    console.error('LLM call failed:', err);
    return {
      type: 'escalation',
      message: "I'm temporarily unable to process your request. A human agent will follow up with you shortly.",
      confidence: 0,
      reasoning: 'Escalated due to LLM service error.',
      retrievedArticles: uniqueArticles,
    };
  }

  // ── Tier 4: Confidence floor — override if confidence is too low ────────
  const tier4Override = llmDecision.can_answer && llmDecision.confidence < 0.45;
  const shouldEscalate = !llmDecision.can_answer || tier4Override;

  if (shouldEscalate) {
    const tier = tier4Override ? '4 (confidence floor override)' : '3 (LLM reasoning)';
    return {
      type: 'escalation',
      message: buildEscalationMessage(llmDecision.escalation_reason),
      confidence: llmDecision.confidence,
      reasoning: `Tier ${tier}: ${tier4Override
        ? `LLM confidence (${(llmDecision.confidence * 100).toFixed(0)}%) is below the 45% threshold.`
        : llmDecision.escalation_reason
      }`,
      retrievedArticles: uniqueArticles,
    };
  }

  return {
    type: 'answer',
    message: llmDecision.answer,
    confidence: llmDecision.confidence,
    reasoning: `Answered at ${(llmDecision.confidence * 100).toFixed(0)}% confidence. Sources: ${uniqueArticles.join(', ')}.`,
    retrievedArticles: uniqueArticles,
  };
}
