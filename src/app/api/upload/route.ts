import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import Papa from 'papaparse'
import OpenAI from 'openai'
import { getChromaClient, COLLECTION_NAME } from '@/lib/chroma'
import { chunkText } from '@/lib/chunker'

async function getEmbeddings(chunks: string[]): Promise<number[][]> {
  const openai = new OpenAI()
  const BATCH = 100
  const embeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += BATCH) {
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks.slice(i, i + BATCH),
    })
    embeddings.push(...data.map((d) => d.embedding))
  }

  return embeddings
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf'
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv'

    if (!isPdf && !isCsv) {
      return NextResponse.json(
        { error: 'Only PDF and CSV files are supported' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let text: string

    if (isPdf) {
      const parsed = await pdfParse(buffer)
      text = parsed.text
    } else {
      const { data } = Papa.parse<Record<string, string>>(buffer.toString('utf-8'), {
        header: true,
        skipEmptyLines: true,
      })
      text = data.map((row) => Object.values(row).join(' ')).join('\n')
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 422 }
      )
    }

    const chunks = chunkText(text)
    const embeddings = await getEmbeddings(chunks)
    console.log(`[upload] ${file.name} - Chroma upsert`)
    console.log(`Uploading ${chunks.length} chunks to Chroma...`)
    console.log(`Uploading ${embeddings.length} embeddings to Chroma...`)
    console.log(`--------------------------------------------`)

    const client = getChromaClient()
    const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME })

    const ts = Date.now()
    await collection.add({
      ids: chunks.map((_, i) => `${file.name}-${ts}-${i}`),
      documents: chunks,
      embeddings,
      metadatas: chunks.map((_, i) => ({
        source: file.name,
        chunk: i,
        uploadedAt: new Date().toISOString(),
      })),
    })

    return NextResponse.json({ success: true, chunks: chunks.length, filename: file.name })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
