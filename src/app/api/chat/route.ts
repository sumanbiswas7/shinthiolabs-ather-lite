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

Always prioritize: Safety > Helpfulness | Compliance > Completeness | Accuracy > Assumptions`

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
    if (docs.length > 0) {
      contextBlock = `\n\nRelevant context from uploaded documents:\n${docs.map((d, i) => `[${i + 1}] ${d}`).join('\n\n')}`
      console.log(`[chat] Retrieved ${docs.length} chunks from Chroma`)
    }
  } catch (err) {
    console.warn('[chat] Chroma unavailable, proceeding without context:', err)
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + contextBlock },
    ...history.slice(-10),
    { role: 'user', content: message },
  ]

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    stream: true,
    max_tokens: 1024,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // First line: JSON metadata (docs for the sources panel), always present
        controller.enqueue(encoder.encode(JSON.stringify({ docs }) + '\n'))
        // Remaining bytes: raw token stream
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
