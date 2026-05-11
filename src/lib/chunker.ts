const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const chunk = normalized.slice(start, start + size).trim()
    if (chunk) chunks.push(chunk)
    start += size - overlap
  }

  return chunks
}
