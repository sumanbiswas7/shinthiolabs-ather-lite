import { useState, useRef, useEffect, useCallback } from 'react'
import juiceAndMeds from '../../history/juice-and-meds.json'
import pregnancyAndMeds from '../../history/pregnancy-and-meds.json'
import tellMeAboutMeds from '../../history/tell-me-about-meds.json'

export type Role = 'user' | 'ai'

export interface Message {
  id: number
  role: Role
  content: string
  time: Date
  confidence?: 'high' | 'medium' | 'low'
  flags?: string[]
  escalate?: boolean
}

export interface HistoryItem {
  id: number
  title: string
  date: string
  messages: Message[]
}

type RawExport = {
  exported_at: string
  messages: Array<{
    id: number
    role: 'user' | 'ai'
    content: string
    time: string
    confidence?: 'high' | 'medium' | 'low'
    flags?: string[]
    escalate?: boolean
  }>
}

function toHistoryItem(raw: RawExport, id: number): HistoryItem {
  const firstUser = raw.messages.find((m) => m.role === 'user')
  const raw_title = firstUser?.content ?? 'Chat'
  const title = raw_title.length > 42 ? raw_title.slice(0, 42) + '…' : raw_title

  const exportedAt = new Date(raw.exported_at)
  const today = new Date()
  const date =
    exportedAt.toDateString() === today.toDateString()
      ? 'Today'
      : exportedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return {
    id,
    title,
    date,
    messages: raw.messages.map((m) => ({ ...m, time: new Date(m.time) })),
  }
}

const INITIAL_HISTORY: HistoryItem[] = [juiceAndMeds, pregnancyAndMeds, tellMeAboutMeds]
  .sort((a, b) => new Date(b.exported_at).getTime() - new Date(a.exported_at).getTime())
  .map((raw, i) => toHistoryItem(raw as RawExport, i + 1))

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export { formatTime }

export function useChat(exportRef: React.MutableRefObject<(() => void) | null>) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeChat, setActiveChat] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY)
  const [contextChunks, setContextChunks] = useState<{ text: string; score: number }[]>([])
  const [contextOpen, setContextOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  useEffect(() => {
    exportRef.current = () => {
      if (messages.length === 0) return
      const payload = {
        exported_at: new Date().toISOString(),
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          time: m.time.toISOString(),
          ...(m.confidence !== undefined && { confidence: m.confidence }),
          ...(m.flags?.length && { flags: m.flags }),
          ...(m.escalate !== undefined && { escalate: m.escalate }),
        })),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ather-chat-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [messages, exportRef])

  useEffect(() => {
    if (activeChat === null) return
    setHistory((prev) => prev.map((item) => (item.id === activeChat ? { ...item, messages } : item)))
  }, [messages, activeChat])

  const streamResponse = useCallback(async (userMsg: string, prevMessages: Message[]) => {
    const streamId = Date.now() + 1
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: prevMessages.slice(-10).map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      setIsTyping(false)
      setMessages((prev) => [...prev, { id: streamId, role: 'ai', content: '', time: new Date() }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let lineBuffer = ''
      let headerParsed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw = decoder.decode(value, { stream: true })

        if (!headerParsed) {
          lineBuffer += raw
          const nlIdx = lineBuffer.indexOf('\n')
          if (nlIdx !== -1) {
            headerParsed = true
            const header = lineBuffer.slice(0, nlIdx).trim()
            const rest = lineBuffer.slice(nlIdx + 1)
            try {
              const { docs, scores, confidence, flags, escalate } = JSON.parse(header) as {
                docs: string[]; scores: number[]
                confidence: 'high' | 'medium' | 'low'
                flags: string[]; escalate: boolean
              }
              if (docs?.length) {
                setContextChunks(docs.map((text, i) => ({ text, score: scores?.[i] ?? 0 })))
                setContextOpen(true)
              }
              setMessages((prev) => prev.map((m) =>
                m.id === streamId ? { ...m, confidence, flags, escalate } : m
              ))
            } catch {}
            if (rest) {
              accumulated += rest
              const snap = accumulated
              setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: snap } : m))
            }
          }
        } else {
          accumulated += raw
          const snap = accumulated
          setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: snap } : m))
        }
      }
    } catch {
      setIsTyping(false)
      setMessages((prev) => [...prev, {
        id: streamId, role: 'ai',
        content: 'Something went wrong. Please try again.',
        time: new Date(),
      }])
    }
  }, [])

  return {
    messages, setMessages,
    input, setInput,
    isTyping, setIsTyping,
    activeChat, setActiveChat,
    history, setHistory,
    contextChunks, contextOpen, setContextOpen,
    textareaRef, messagesEndRef,
    streamResponse,
  }
}
