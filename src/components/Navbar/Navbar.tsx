'use client'

import styles from "./Navbar.module.scss";
import { useUpload } from "./useUpload";

interface NavbarProps {
  onMenuToggle: () => void;
  onExport: () => void;
}

export default function Navbar({ onMenuToggle, onExport }: NavbarProps) {
  const { uploadState, uploadLabel, fileInputRef, handleFileChange, triggerPicker } = useUpload();

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
        <div className={styles.uploadWrapper}>
          <button
            className={`${styles.iconBtn} ${uploadState === 'uploading' ? styles.iconBtnLoading : ''} ${uploadState === 'done' ? styles.iconBtnDone : ''} ${uploadState === 'error' ? styles.iconBtnError : ''}`}
            onClick={triggerPicker}
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
          {uploadState === 'idle' && (
            <div className={styles.uploadTooltip}>
              <div className={styles.tooltipArrowUp} />
              <div className={styles.tooltipStep}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                </svg>
                <span>Split into chunks</span>
              </div>
              <div className={styles.tooltipDivider}>→</div>
              <div className={styles.tooltipStep}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                <span>Embedded via OpenAI</span>
              </div>
              <div className={styles.tooltipDivider}>→</div>
              <div className={styles.tooltipStep}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                </svg>
                <span>Stored in Chroma</span>
              </div>
            </div>
          )}
        </div>
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
