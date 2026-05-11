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

const AI_RESPONSES = [
  (query: string) =>
    `I've analyzed your request regarding "${query.slice(0, 40)}..."\n\nHere's a structured breakdown of key insights based on current pharma GTM best practices. I can dive deeper into any specific area — HCP engagement, patient support pathways, or commercial operations.`,
  () =>
    `Great question. Based on current field data and engagement patterns, here are the top recommendations:\n\n1. **Prioritize Tier 1 HCPs** in your territory with tailored messaging\n2. **Align patient support** touchpoints with the prescription journey\n3. **Leverage digital channels** for non-personal promotion\n\nWant me to elaborate on any of these?`,
  () =>
    `I can help with that. Let me pull together the relevant data points...\n\nFor your commercial team, the most impactful levers right now are:\n- Segmentation refinement based on prescribing behavior\n- Omnichannel orchestration across rep + digital\n- Real-time field force analytics\n\nShall I draft a detailed action plan?`,
];

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
}

export default function ChatInterface({ sidebarOpen, onSidebarClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeChat, setActiveChat] = useState<number | null>(null);
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

  const simulateResponse = useCallback((userMsg: string) => {
    setIsTyping(true);
    const delay = 800 + Math.random() * 800;
    const pick = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "ai",
          content: pick(userMsg),
          time: new Date(),
        },
      ]);
    }, delay);
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || text.length > MAX_CHARS) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: text, time: new Date() },
    ]);
    setInput("");
    simulateResponse(text);
  }, [input, simulateResponse]);

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

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.messages}>
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
