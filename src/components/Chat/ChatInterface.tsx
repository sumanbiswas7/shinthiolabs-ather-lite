'use client'

import { useCallback } from 'react'
import styles from './ChatInterface.module.scss'
import { useChat, formatTime } from './useChat'
import { useVoiceInput } from './useVoiceInput'

const atherLogo = '/ather-logo.svg'
const MAX_CHARS = 4000

const SUGGESTIONS = [
  'What are the side effects of metformin?',
  'Can a pregnant take metformin?',
] as const

interface ChatInterfaceProps {
  sidebarOpen: boolean
  onSidebarClose: () => void
  exportRef: React.MutableRefObject<(() => void) | null>
}

export default function ChatInterface({ sidebarOpen, onSidebarClose, exportRef }: ChatInterfaceProps) {
  const {
    messages, setMessages,
    input, setInput,
    isTyping, setIsTyping,
    activeChat, setActiveChat,
    history, setHistory,
    contextChunks, contextOpen, setContextOpen,
    textareaRef, messagesEndRef,
    streamResponse,
  } = useChat(exportRef)

  const { isListening, stopListening, toggleMic } = useVoiceInput(setInput)

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || text.length > MAX_CHARS) return

    if (isListening) stopListening()

    const userMsg = { id: Date.now(), role: 'user' as const, content: text, time: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    if (activeChat === null) {
      const newId = Date.now() + 1
      const title = text.length > 45 ? text.slice(0, 45) + '…' : text
      setHistory((prev) => [{ id: newId, title, date: 'Today', messages: [] }, ...prev])
      setActiveChat(newId)
    }

    streamResponse(text, messages)
  }, [input, messages, activeChat, isListening, stopListening, setMessages, setInput, setIsTyping, setHistory, setActiveChat, streamResponse])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleSuggestion = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  const charCount = input.length
  const charClass =
    charCount > MAX_CHARS ? styles.over : charCount > MAX_CHARS * 0.85 ? styles.near : ''

  return (
    <div className={styles.layout}>
      {sidebarOpen && <div className={styles.backdrop} onClick={onSidebarClose} />}

      {/* Left sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3>Recent</h3>
          <button
            className={styles.newChatBtn}
            title="New chat"
            aria-label="New chat"
            onClick={() => {
              setMessages([])
              setActiveChat(null)
              setContextOpen(false)
              onSidebarClose()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className={styles.historyList}>
          {history.map((item) => (
            <button
              key={item.id}
              className={`${styles.historyItem} ${activeChat === item.id ? styles.active : ''}`}
              onClick={() => { setActiveChat(item.id); setMessages(item.messages); setContextOpen(false) }}
            >
              <span className={styles.historyIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className={styles.historyText}>{item.title}</span>
              <span className={styles.historyDate}>{item.date}</span>
            </button>
          ))}
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.modelBadge}>
            <span />
            Ather Lite
          </div>
        </div>
      </aside>

      {/* Right context sidebar */}
      {contextOpen && <div className={styles.contextBackdrop} onClick={() => setContextOpen(false)} />}
      <aside className={`${styles.contextSidebar} ${contextOpen ? styles.contextSidebarOpen : ''}`}>
        <div className={styles.contextHeader}>
          <span className={styles.contextTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Sources
            <span className={styles.contextCount}>{contextChunks.length}</span>
          </span>
          <button className={styles.contextClose} onClick={() => setContextOpen(false)} aria-label="Close sources">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={styles.contextList}>
          {contextChunks.map((chunk, i) => (
            <div key={i} className={styles.contextChunk}>
              <span className={styles.contextChunkNum}>{i + 1}</span>
              <div className={styles.contextChunkBody}>
                <p className={styles.contextChunkText}>{chunk.text}</p>
                <span className={`${styles.scoreTag} ${chunk.score >= 80 ? styles.scoreHigh : chunk.score >= 60 ? styles.scoreMid : styles.scoreLow}`}>
                  {chunk.score}% match
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className={`${styles.main} ${contextOpen ? styles.mainShifted : ''}`}>
        <div className={styles.messages}>
          {contextChunks.length > 0 && (
            <button
              className={`${styles.sourcesToggle} ${contextOpen ? styles.sourcesToggleActive : ''}`}
              onClick={() => setContextOpen((o) => !o)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {contextChunks.length} source{contextChunks.length !== 1 ? 's' : ''}
            </button>
          )}

          <div className={styles.messagesInner}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <img src={atherLogo} alt="Ather" className={styles.welcomeOrb} />
                <div className={styles.welcomeHeading}>
                  <h2 className={styles.welcomeTitle}>
                    <span>Your always-on</span>
                    <span>med expert.</span>
                  </h2>
                  <p className={styles.welcomeAccent}>
                    <span className={styles.welcomeAccentMark}>✦</span>
                    clinical depth, delivered instantly
                  </p>
                </div>
                <p className={styles.welcomeSub}>
                  Clinical-grade answers across efficacy, safety, dosing, MOA and access — with the depth of a scientific exchange.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className={styles.suggestion} onClick={() => handleSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`${styles.messageRow} ${styles[msg.role]}`}>
                  {msg.role === 'ai' && <div className={`${styles.avatar} ${styles.avatarAI}`} />}
                  <div className={styles.bubbleWrapper}>
                    <div className={styles.bubble}>
                      {msg.content.split('\n').map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))}
                      <div className={styles.messageTime}>{formatTime(msg.time)}</div>
                    </div>
                    {msg.role === 'ai' && msg.confidence && (
                      <div className={styles.messageMeta}>
                        <span className={`${styles.confidenceBadge} ${styles[`confidence_${msg.confidence}`]}`}>
                          {msg.confidence === 'high' ? '● High confidence' : msg.confidence === 'medium' ? '◐ Medium confidence' : '○ Low confidence'}
                        </span>
                        {msg.flags && msg.flags.filter(f => f !== 'auto_blocked').map(flag => (
                          <span key={flag} className={styles.complianceFlag}>{flag.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    {msg.role === 'ai' && msg.escalate && (
                      <div className={styles.escalationBanner}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Potential adverse event — escalate to your pharmacovigilance team
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className={`${styles.avatar} ${styles.avatarUser}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))
            )}

            {isTyping && (
              <div className={`${styles.messageRow} ${styles.ai}`}>
                <div className={`${styles.avatar} ${styles.avatarAI}`} />
                <div className={styles.typing}>
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrap}>
            <div className={styles.inputRow}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                aria-label="Message input"
              />
              <div className={styles.inputActions}>
                <button
                  className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                  aria-label="Voice input"
                  onClick={toggleMic}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </button>
                <button
                  className={styles.sendBtn}
                  onClick={send}
                  disabled={!input.trim() || charCount > MAX_CHARS}
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={styles.inputFooter}>
              <span className={styles.inputHint}>
                <kbd>Enter</kbd> to send · <kbd>⇧ Enter</kbd> for new line
              </span>
              {charCount > 0 && (
                <span className={`${styles.charCount} ${charClass}`}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
