'use client'

import { useState, useRef } from 'react'
import Navbar from '../components/Navbar/Navbar'
import ChatInterface from '../components/Chat/ChatInterface'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const exportRef = useRef<(() => void) | null>(null)

  return (
    <>
      <Navbar
        onMenuToggle={() => setSidebarOpen((s) => !s)}
        onExport={() => exportRef.current?.()}
      />
      <ChatInterface
        sidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
        exportRef={exportRef}
      />
    </>
  )
}
