import { CloudClient } from 'chromadb'

export const COLLECTION_NAME = 'medical-data'

export function getChromaClient(): CloudClient {
  return new CloudClient({
    apiKey: process.env.CHROMA_API_KEY,
    tenant: '8703f8ee-fad1-4d49-bc54-e7f51f145f40',
    database: 'medical-data',
  })
}
