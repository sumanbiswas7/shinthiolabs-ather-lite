import { useState, useRef } from 'react'

export type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export function useUpload() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadLabel, setUploadLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploadState('uploading')
    setUploadLabel(file.name)

    const body = new FormData()
    body.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setUploadState('done')
      setUploadLabel(`${file.name} — ${json.chunks} chunks`)
    } catch (err) {
      setUploadState('error')
      setUploadLabel(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setTimeout(() => setUploadState('idle'), 4000)
    }
  }

  const triggerPicker = () => fileInputRef.current?.click()

  return { uploadState, uploadLabel, fileInputRef, handleFileChange, triggerPicker }
}
