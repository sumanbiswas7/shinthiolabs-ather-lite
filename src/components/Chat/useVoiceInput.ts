import { useState, useRef, useCallback } from 'react'

export function useVoiceInput(setInput: React.Dispatch<React.SetStateAction<string>>) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<{ stop(): void } | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playBeep = useCallback((type: 'start' | 'stop') => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current

      const play = () => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        const now = ctx.currentTime
        if (type === 'start') {
          osc.frequency.setValueAtTime(600, now)
          osc.frequency.linearRampToValueAtTime(900, now + 0.12)
        } else {
          osc.frequency.setValueAtTime(900, now)
          osc.frequency.linearRampToValueAtTime(500, now + 0.12)
        }
        gain.gain.setValueAtTime(0.25, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.18)
        osc.start(now)
        osc.stop(now + 0.18)
      }

      if (ctx.state === 'suspended') {
        ctx.resume().then(play)
      } else {
        play()
      }
    } catch {}
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    playBeep('stop')
  }, [playBeep])

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening()
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return

    playBeep('start')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let final = ''
    recognition.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setInput(final + interim)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => { setIsListening(false); playBeep('stop') }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, stopListening, playBeep, setInput])

  return { isListening, stopListening, toggleMic }
}
