'use client'

import { useState, useRef } from "react";
import styles from "./Navbar.module.scss";

interface NavbarProps {
  onMenuToggle: () => void;
  onExport: () => void;
}

export default function Navbar({ onMenuToggle, onExport }: NavbarProps) {
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadLabel, setUploadLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadState('uploading');
    setUploadLabel(file.name);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      setUploadState('done');
      setUploadLabel(`${file.name} — ${json.chunks} chunks`);
    } catch (err) {
      setUploadState('error');
      setUploadLabel(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTimeout(() => setUploadState('idle'), 4000);
    }
  };

  return (
    <nav className={styles.nav}>
      <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Toggle menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <a href="/" className={styles.brand}>
        <img src="/logo.svg" alt="Synthio Labs" />
      </a>

      <div className={styles.actions}>
        {uploadState !== 'idle' && (
          <span className={`${styles.uploadStatus} ${styles[`uploadStatus_${uploadState}`]}`}>
            {uploadState === 'uploading' && `↑ ${uploadLabel}`}
            {uploadState === 'done' && `✓ ${uploadLabel}`}
            {uploadState === 'error' && `✕ ${uploadLabel}`}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className={`${styles.iconBtn} ${uploadState === 'uploading' ? styles.iconBtnLoading : ''} ${uploadState === 'done' ? styles.iconBtnDone : ''} ${uploadState === 'error' ? styles.iconBtnError : ''}`}
          title="Upload PDF or CSV"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === 'uploading'}
        >
          {uploadState === 'uploading' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinnerIcon}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>
        <button className={styles.iconBtn} title="Export chat" onClick={onExport}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}
