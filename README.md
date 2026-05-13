# Ather Lite

Chat assistant for healthcare professionals. Upload medical documents (PDF or CSV), ask questions, and get answers grounded strictly in the uploaded content.

## How it works

```
Upload PDF/CSV → chunk text → embed via OpenAI → store in Chroma
Query → embed → similarity search → GPT-4o answers from context
```

Responses include a **confidence score** (L2 distance converted to 0–100) and are filtered through hard-coded compliance rules before being shown.

## Compliance rules

The system prompt enforces these at the LLM level:

- No hallucination — answer only from retrieved context
- No prescription advice
- No off-label recommendations
- Adverse event escalation when a safety concern is detected
- Consistent answers across similar queries

## Blocked patterns

These regex patterns are checked against every model response. A match replaces the output with a safe fallback — the LLM never sees the block, it happens post-generation:

| Pattern | What it catches |
|---|---|
| `you should (prescribe\|take\|stop\|switch\|increase\|decrease)` | Direct action instructions to the user |
| `(prescribe\|administer) ... to (your) patient` | Clinician-directed prescribing language |
| `recommended (dose\|dosage\|dosing) for you` | Personalised dosing recommendations |
| `stop (taking\|using) ... immediately` | Unsolicited discontinuation advice |

## Scaling to 5,000 users

The vector DB (Chroma Cloud) and LLM (OpenAI) are already hosted — the main bottlenecks at scale are the app layer and the upload pipeline.

**App servers** — already handled. Vercel scales Next.js serverless functions automatically.

**File uploads** — stream files to S3 before processing instead of holding them in memory. Vercel functions have a 1 GB RAM cap — parsing large PDFs in memory across concurrent uploads will crash the function.

**Embedding queue** — wrap the upload pipeline in a job queue (BullMQ + Redis). Embedding 100+ chunks per upload is slow; offload it to a worker so the HTTP response returns immediately.

**OpenAI rate limits** — at 5k users you'll hit TPM/RPM limits fast. Add per-user request throttling and exponential backoff on 429s.

**Caching** — cache embeddings for identical query strings (Redis, 1h TTL). Repeat queries (same drug name, same question) are common in medical workflows.

**Auth + tenancy** — right now there's no login and all uploads go into one shared Chroma collection. Add auth (Auth.js or Clerk) and give each organisation its own collection so their documents stay isolated from other users' data.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + TypeScript |
| Styling | SCSS Modules |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector DB | Chroma Cloud |
| LLM | OpenAI GPT-4o |
| Voice input | Web Speech API (browser-native) |