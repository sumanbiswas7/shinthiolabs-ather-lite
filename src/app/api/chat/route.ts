import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getChromaClient, COLLECTION_NAME } from '@/lib/chroma'

const SYSTEM_PROMPT = `You are Ather, a clinical-information assistant for Healthcare Professionals (HCPs).

You handle two types of messages differently:

CONVERSATIONAL messages (greetings, clarifications, small talk, questions about your capabilities):
- Respond naturally and helpfully. You are friendly and professional.
- Example: "Hi" → greet back. "What can you do?" → explain your purpose.

CLINICAL / MEDICAL questions (dosing, efficacy, safety, indications, adverse events, mechanism of action, market access, etc.):
- Answer ONLY from the retrieved context provided below (from approved medical PDFs and clinical documents).
- If no relevant context is retrieved, reply: "I don't have approved information for that in the uploaded documents. Please upload the relevant medical document and ask again."

Follow these 5 compliance rules strictly for all clinical responses:

1. No Hallucination
   Only answer from retrieved context. Never guess, infer, or use general model knowledge for clinical facts.

2. No Prescription Advice
   Never tell users to prescribe, stop, or change treatment. Only provide source-backed medical information.

3. No Off-Label Recommendations
   Only discuss approved indications. If asked about unapproved use, reply:
   "I can only provide information for approved indications."

4. Adverse Event Escalation
   If serious side effects or safety events are mentioned, reply:
   "This may require adverse event reporting and escalation to your pharmacovigilance team."

5. Consistent Answers
   If the same question is asked multiple times differently, your answer must remain stable, accurate, and compliant.

Always prioritize: Safety > Helpfulness | Compliance > Completeness | Accuracy > Assumptions

Set the structured output fields as follows:
- confidence: "high" if the answer is fully supported by retrieved context, "medium" if partially supported, "low" if little or no relevant context was retrieved
- sources_used: 1-based indices of which context chunks you actually referenced (empty array if none)
- compliance_flags: include any triggered rules — "prescription_advice", "off_label", "adverse_event", "no_context"
- requires_escalation: true only if a serious adverse event or urgent safety concern is present`

// Hard-coded output validation — these patterns must never appear regardless of prompt
const BLOCKED_PATTERNS: RegExp[] = [
  /\byou should (prescribe|take|stop|switch|increase|decrease)\b/i,
  /\b(prescribe|administer) .{0,30} to (your )?patient/i,
  /\brecommended (dose|dosage|dosing) for you\b/i,
  /\bstop (taking|using) .{0,30} immediately\b/i,
]

function validateOutput(answer: string): string[] {
  const violations: string[] = []
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(answer)) {
      violations.push('auto_blocked')
      break
    }
  }
  return violations
}

async function getQueryEmbedding(openai: OpenAI, text: string): Promise<number[]> {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: [text],
  })
  return data[0].embedding
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, history = [] } = body as {
    message: string
    history: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const openai = new OpenAI()

  // RAG: embed query and retrieve relevant chunks from Chroma
  let docs: string[] = []
  let scores: number[] = []
  let contextBlock = ''
  try {
    const queryEmbedding = await getQueryEmbedding(openai, message)
    const client = getChromaClient()
    const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME })
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 4,
    })
    docs = (results.documents?.[0]?.filter(Boolean) ?? []) as string[]
    scores = (results.distances?.[0] ?? []).map((d) => Math.round((1 - d / 2) * 100))
    if (docs.length > 0) {
      contextBlock = `\n\nRelevant context from uploaded documents:\n${docs.map((d, i) => `[${i + 1}] ${d}`).join('\n\n')}`
    }
  } catch (err) {
    console.warn('[chat] Chroma unavailable, proceeding without context:', err)
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + contextBlock },
    ...history.slice(-10),
    { role: 'user', content: message },
  ]

  // Structured output — model must return validated JSON schema
  let answer = 'Something went wrong. Please try again.'
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let flags: string[] = []
  let escalate = false

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'clinical_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              answer:               { type: 'string' },
              confidence:           { type: 'string', enum: ['high', 'medium', 'low'] },
              sources_used:         { type: 'array', items: { type: 'number' } },
              compliance_flags:     { type: 'array', items: { type: 'string' } },
              requires_escalation:  { type: 'boolean' },
            },
            required: ['answer', 'confidence', 'sources_used', 'compliance_flags', 'requires_escalation'],
            additionalProperties: false,
          },
        },
      },
    })

    const parsed = JSON.parse(response.choices[0].message.content ?? '{}')
    answer      = parsed.answer ?? answer
    confidence  = parsed.confidence ?? 'low'
    flags       = parsed.compliance_flags ?? []
    escalate    = parsed.requires_escalation ?? false

    // Layer 2 — hard output validation (overrides model judgment)
    const violations = validateOutput(answer)
    if (violations.length > 0) {
      flags = [...new Set([...flags, ...violations])]
      answer = 'I cannot provide that type of recommendation. Please refer to the approved prescribing information directly.'
    }
  } catch (err) {
    console.error('[chat] LLM error', err)
  }

  // Stream: header line + answer text
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ docs, scores, confidence, flags, escalate }) + '\n'))
      controller.enqueue(encoder.encode(answer))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
