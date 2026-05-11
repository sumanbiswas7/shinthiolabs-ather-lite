'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./ChatInterface.module.scss";

const atherLogo = '/ather-logo.svg'

const MAX_CHARS = 4000;

const SUGGESTIONS = [
  // 'Summarize key findings',
  // 'Draft an HCP email',
  // 'Analyze field data',
  // 'Create a call plan',
] as const;

interface HistoryItem {
  id: number;
  title: string;
  date: string;
}

const INITIAL_HISTORY: HistoryItem[] = [
  { id: 1, title: "HCP engagement strategy Q2", date: "Today" },
  { id: 2, title: "Patient support program review", date: "Yesterday" },
  { id: 3, title: "Territory performance analysis", date: "Mon" },
  { id: 4, title: "Marketing material compliance", date: "Mon" },
  { id: 5, title: "KOL mapping northeast region", date: "Sun" },
];

type Role = "user" | "ai";

interface Message {
  id: number;
  role: Role;
  content: string;
  time: Date;
}


function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

interface ChatInterfaceProps {
  sidebarOpen: boolean;
  onSidebarClose: () => void;
  exportRef: React.MutableRefObject<(() => void) | null>;
}

export default function ChatInterface({ sidebarOpen, onSidebarClose, exportRef }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [contextDocs, setContextDocs] = useState<string[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    autoResize();
  }, [input]);

  useEffect(() => {
    exportRef.current = () => {
      if (messages.length === 0) return;
      const lines = messages.map((m) => {
        const role = m.role === 'user' ? 'You' : 'Ather';
        const time = formatTime(m.time);
        return `[${time}] ${role}:\n${m.content}`;
      });
      const text = `Ather Chat Export\n${new Date().toLocaleString()}\n${'─'.repeat(40)}\n\n${lines.join('\n\n')}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ather-chat-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }, [messages, exportRef]);

  const streamResponse = useCallback(async (userMsg: string, history: Message[]) => {
    const streamId = Date.now() + 1;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: history.slice(-10).map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      setIsTyping(false);
      setMessages((prev) => [...prev, { id: streamId, role: 'ai', content: '', time: new Date() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let lineBuffer = '';
      let headerParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });

        if (!headerParsed) {
          lineBuffer += raw;
          const nlIdx = lineBuffer.indexOf('\n');
          if (nlIdx !== -1) {
            headerParsed = true;
            const header = lineBuffer.slice(0, nlIdx).trim();
            const rest = lineBuffer.slice(nlIdx + 1);
            try {
              const { docs } = JSON.parse(header) as { docs: string[] };
              if (docs?.length) {
                setContextDocs(docs);
                setContextOpen(true);
              }
            } catch {}
            if (rest) {
              accumulated += rest;
              const snap = accumulated;
              setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: snap } : m));
            }
          }
        } else {
          accumulated += raw;
          const snap = accumulated;
          setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: snap } : m));
        }
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [...prev, {
        id: streamId,
        role: 'ai',
        content: 'Something went wrong. Please try again.',
        time: new Date(),
      }]);
    }
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || text.length > MAX_CHARS) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: text, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    streamResponse(text, messages);
  }, [input, messages, streamResponse]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const charCount = input.length;
  const charClass =
    charCount > MAX_CHARS
      ? styles.over
      : charCount > MAX_CHARS * 0.85
        ? styles.near
        : "";

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={onSidebarClose} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <h3>Recent</h3>
        </div>

        <div className={styles.historyList}>
          {INITIAL_HISTORY.map((item) => (
            <button
              key={item.id}
              className={`${styles.historyItem} ${activeChat === item.id ? styles.active : ""}`}
              onClick={() => setActiveChat(item.id)}
            >
              <span className={styles.historyIcon}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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

      {/* Context backdrop (mobile) */}
      {contextOpen && (
        <div className={styles.contextBackdrop} onClick={() => setContextOpen(false)} />
      )}

      {/* Right context sidebar */}
      <aside className={`${styles.contextSidebar} ${contextOpen ? styles.contextSidebarOpen : ""}`}>
        <div className={styles.contextHeader}>
          <span className={styles.contextTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Sources
            <span className={styles.contextCount}>{contextDocs.length}</span>
          </span>
          <button className={styles.contextClose} onClick={() => setContextOpen(false)} aria-label="Close sources">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={styles.contextList}>
          {contextDocs.map((doc, i) => (
            <div key={i} className={styles.contextChunk}>
              <span className={styles.contextChunkNum}>{i + 1}</span>
              <p className={styles.contextChunkText}>{doc}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className={`${styles.main} ${contextOpen ? styles.mainShifted : ""}`}>
        <div className={styles.messages}>
          {contextDocs.length > 0 && (
            <button
              className={`${styles.sourcesToggle} ${contextOpen ? styles.sourcesToggleActive : ""}`}
              onClick={() => setContextOpen((o) => !o)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {contextDocs.length} source{contextDocs.length !== 1 ? "s" : ""}
            </button>
          )}
          <div className={styles.messagesInner}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <img
                  src={atherLogo}
                  alt="Ather"
                  className={styles.welcomeOrb}
                />
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
                    <button
                      key={s}
                      className={styles.suggestion}
                      onClick={() => handleSuggestion(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${styles[msg.role]}`}
                >
                  {msg.role === "ai" && (
                    <div className={`${styles.avatar} ${styles.avatarAI}`} />
                  )}
                  <div className={styles.bubble}>
                    {msg.content.split("\n").map((line, i, arr) => (
                      <span key={i}>
                        {line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))}
                    <div className={styles.messageTime}>
                      {formatTime(msg.time)}
                    </div>
                  </div>
                  {msg.role === "user" && (
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
                  <span />
                  <span />
                  <span />
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
                  className={styles.micBtn}
                  title="Voice input"
                  aria-label="Voice input"
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
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
  );
}
