'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./ChatInterface.module.scss";

const atherLogo = '/ather-logo.svg'

const MAX_CHARS = 4000;

const SUGGESTIONS = [
  'What are the side effects of metformin?',
  'Can a pregnant take metformin?',
] as const;

type Role = "user" | "ai";

interface Message {
  id: number;
  role: Role;
  content: string;
  time: Date;
  confidence?: 'high' | 'medium' | 'low';
  flags?: string[];
  escalate?: boolean;
}

export interface HistoryItem {
  id: number;
  title: string;
  date: string;
  messages: Message[];
}

export const d = (h: number, m: number) => { const t = new Date('2026-05-11'); t.setHours(h, m, 0, 0); return t; };

const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 1,
    title: "Metformin & Paracetamol overview",
    date: "Today",
    messages: [
      { id: 11, role: "user", content: "Tell me about metphormin", time: d(23, 0) },
      { id: 12, role: "ai", content: "Metformin is an antihyperglycemic agent commonly used to improve glucose tolerance in patients with type 2 diabetes mellitus. It helps lower both basal and postprandial plasma glucose levels through several mechanisms:\n\n1. Decreases hepatic glucose production.\n2. Reduces intestinal absorption of glucose.\n3. Improves insulin sensitivity by increasing peripheral glucose uptake and utilization.\n\nMetformin hydrochloride tablets are available in strengths of 500 mg, 850 mg, and 1,000 mg. For more specific information on dosing or indications, please let me know!", time: d(23, 1) },
      { id: 13, role: "user", content: "Tell me about paracetamol", time: d(23, 1) },
      { id: 14, role: "ai", content: "I don't have approved information for that in the uploaded documents. Please upload the relevant medical document and ask again.", time: d(23, 1) },
    ],
  },
  {
    id: 2,
    title: "Metformin in pregnancy",
    date: "Today",
    messages: [
      { id: 21, role: "user", content: "Can a pregnant take metphormin?", time: d(23, 0) },
      { id: 22, role: "ai", content: "Limited data with metformin hydrochloride tablets in pregnant women are not sufficient to determine a drug-associated risk for major birth defects or miscarriage. Published studies have not reported a clear association between metformin and major birth defects or miscarriage risk. However, there are risks to the mother and fetus associated with poorly controlled diabetes mellitus during pregnancy. It is important for pregnant individuals to talk with their healthcare provider about the best way to control blood sugar while pregnant.", time: d(23, 0) },
    ],
  },
  {
    id: 3,
    title: "Metformin side effects",
    date: "Today",
    messages: [
      { id: 31, role: "user", content: "what can u do?", time: d(22, 57) },
      { id: 32, role: "ai", content: "I'm here to assist healthcare professionals by providing clinical information about medications, including details on dosing, efficacy, safety, and indications. If you have specific medical questions, feel free to ask!", time: d(22, 57) },
      { id: 33, role: "user", content: "what are the side effects of metphormin?", time: d(22, 58) },
      { id: 34, role: "ai", content: "The side effects of metformin hydrochloride tablets include:\n\n1. **Lactic Acidosis**: A rare but serious condition that can occur, causing a buildup of lactic acid in the blood. Symptoms may include feeling very weak and tired, unusual muscle pain, trouble breathing, unusual sleepiness, feeling cold, dizziness, or slow/irregular heartbeat. This condition is a medical emergency.\n\n2. **Metallic Taste**: About 3 out of every 100 people may experience an unpleasant metallic taste when starting the medication, which usually lasts for a short time.\n\n3. **Hypoglycemia**: While metformin rarely causes low blood sugar by itself, hypoglycemia can occur if a person does not eat enough, consumes alcohol, or takes other medications to lower blood sugar.\n\n4. Other common side effects may include gastrointestinal issues such as nausea, vomiting, and diarrhea.\n\nIf you experience serious side effects, this may require adverse event reporting and escalation to your pharmacovigilance team.", time: d(22, 58) },
    ],
  },
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
  exportRef: React.MutableRefObject<(() => void) | null>;
}

export default function ChatInterface({ sidebarOpen, onSidebarClose, exportRef }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY);
  const [contextChunks, setContextChunks] = useState<{ text: string; score: number }[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop(): void } | null>(null);
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

  const playBeep = useCallback((type: 'start' | 'stop') => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'start') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(900, now + 0.12);
      } else {
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.12);
      }
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
      osc.onended = () => ctx.close();
    } catch {}
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    playBeep('stop');
  }, [playBeep]);

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let final = '';
    recognition.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInput(final + interim);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); playBeep('stop'); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    playBeep('start');
  }, [isListening, stopListening, playBeep]);

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
              const { docs, scores, confidence, flags, escalate } = JSON.parse(header) as {
                docs: string[]; scores: number[];
                confidence: 'high' | 'medium' | 'low';
                flags: string[]; escalate: boolean;
              };
              if (docs?.length) {
                setContextChunks(docs.map((text, i) => ({ text, score: scores?.[i] ?? 0 })));
                setContextOpen(true);
              }
              setMessages((prev) => prev.map((m) =>
                m.id === streamId ? { ...m, confidence, flags, escalate } : m
              ));
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

    if (isListening) stopListening();

    const userMsg: Message = { id: Date.now(), role: 'user', content: text, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    if (activeChat === null) {
      const newId = Date.now() + 1;
      const title = text.length > 45 ? text.slice(0, 45) + '…' : text;
      setHistory((prev) => [{ id: newId, title, date: 'Today', messages: [] }, ...prev]);
      setActiveChat(newId);
    }

    streamResponse(text, messages);
  }, [input, messages, activeChat, isListening, stopListening, streamResponse]);

  useEffect(() => {
    if (activeChat === null) return;
    setHistory((prev) =>
      prev.map((item) => (item.id === activeChat ? { ...item, messages } : item))
    );
  }, [messages, activeChat]);

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
          <button
            className={styles.newChatBtn}
            title="New chat"
            aria-label="New chat"
            onClick={() => {
              setMessages([]);
              setActiveChat(null);
              setContextChunks([]);
              setContextOpen(false);
              onSidebarClose();
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
              className={`${styles.historyItem} ${activeChat === item.id ? styles.active : ""}`}
              onClick={() => { setActiveChat(item.id); setMessages(item.messages); setContextChunks([]); setContextOpen(false); }}
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
      <main className={`${styles.main} ${contextOpen ? styles.mainShifted : ""}`}>
        <div className={styles.messages}>
          {contextChunks.length > 0 && (
            <button
              className={`${styles.sourcesToggle} ${contextOpen ? styles.sourcesToggleActive : ""}`}
              onClick={() => setContextOpen((o) => !o)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {contextChunks.length} source{contextChunks.length !== 1 ? "s" : ""}
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
                  <div className={styles.bubbleWrapper}>
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
                    {msg.role === "ai" && msg.confidence && (
                      <div className={styles.messageMeta}>
                        <span className={`${styles.confidenceBadge} ${styles[`confidence_${msg.confidence}`]}`}>
                          {msg.confidence === 'high' ? '● High confidence' : msg.confidence === 'medium' ? '◐ Medium confidence' : '○ Low confidence'}
                        </span>
                        {msg.flags && msg.flags.filter(f => f !== 'auto_blocked').map(flag => (
                          <span key={flag} className={styles.complianceFlag}>{flag.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    {msg.role === "ai" && msg.escalate && (
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
                  className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ""}`}
                  title={isListening ? "Stop listening" : "Voice input"}
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
