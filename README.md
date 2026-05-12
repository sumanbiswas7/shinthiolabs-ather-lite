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

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + TypeScript |
| Styling | SCSS Modules |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector DB | Chroma |
| LLM | OpenAI GPT-4o |
| Voice input | Web Speech API (browser-native) |