import { useState, useRef, useEffect, useCallback } from 'react'

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

const d = (h: number, m: number) => {
  const t = new Date('2026-05-11')
  t.setHours(h, m, 0, 0)
  return t
}

const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 1,
    title: 'Metformin & Paracetamol overview',
    date: 'Today',
    messages: [
      { id: 11, role: 'user', content: 'Tell me about metphormin', time: d(23, 0) },
      { id: 12, role: 'ai', content: 'Metformin is an antihyperglycemic agent commonly used to improve glucose tolerance in patients with type 2 diabetes mellitus. It helps lower both basal and postprandial plasma glucose levels through several mechanisms:\n\n1. Decreases hepatic glucose production.\n2. Reduces intestinal absorption of glucose.\n3. Improves insulin sensitivity by increasing peripheral glucose uptake and utilization.\n\nMetformin hydrochloride tablets are available in strengths of 500 mg, 850 mg, and 1,000 mg. For more specific information on dosing or indications, please let me know!', time: d(23, 1) },
      { id: 13, role: 'user', content: 'Tell me about paracetamol', time: d(23, 1) },
      { id: 14, role: 'ai', content: "I don't have approved information for that in the uploaded documents. Please upload the relevant medical document and ask again.", time: d(23, 1) },
    ],
  },
  {
    id: 2,
    title: 'Metformin in pregnancy',
    date: 'Today',
    messages: [
      { id: 21, role: 'user', content: 'Can a pregnant take metphormin?', time: d(23, 0) },
      { id: 22, role: 'ai', content: 'Limited data with metformin hydrochloride tablets in pregnant women are not sufficient to determine a drug-associated risk for major birth defects or miscarriage. Published studies have not reported a clear association between metformin and major birth defects or miscarriage risk. However, there are risks to the mother and fetus associated with poorly controlled diabetes mellitus during pregnancy. It is important for pregnant individuals to talk with their healthcare provider about the best way to control blood sugar while pregnant.', time: d(23, 0) },
    ],
  },
  {
    id: 3,
    title: 'Metformin side effects',
    date: 'Today',
    messages: [
      { id: 31, role: 'user', content: 'what can u do?', time: d(22, 57) },
      { id: 32, role: 'ai', content: "I'm here to assist healthcare professionals by providing clinical information about medications, including details on dosing, efficacy, safety, and indications. If you have specific medical questions, feel free to ask!", time: d(22, 57) },
      { id: 33, role: 'user', content: 'what are the side effects of metphormin?', time: d(22, 58) },
      { id: 34, role: 'ai', content: 'The side effects of metformin hydrochloride tablets include:\n\n1. **Lactic Acidosis**: A rare but serious condition that can occur, causing a buildup of lactic acid in the blood. Symptoms may include feeling very weak and tired, unusual muscle pain, trouble breathing, unusual sleepiness, feeling cold, dizziness, or slow/irregular heartbeat. This condition is a medical emergency.\n\n2. **Metallic Taste**: About 3 out of every 100 people may experience an unpleasant metallic taste when starting the medication, which usually lasts for a short time.\n\n3. **Hypoglycemia**: While metformin rarely causes low blood sugar by itself, hypoglycemia can occur if a person does not eat enough, consumes alcohol, or takes other medications to lower blood sugar.\n\n4. Other common side effects may include gastrointestinal issues such as nausea, vomiting, and diarrhea.\n\nIf you experience serious side effects, this may require adverse event reporting and escalation to your pharmacovigilance team.', time: d(22, 58) },
    ],
  },
]

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
