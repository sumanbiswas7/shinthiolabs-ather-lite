'use client'

import { useState } from 'react'
import Navbar from '../components/Navbar/Navbar'
import ChatInterface from '../components/Chat/ChatInterface'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <Navbar onMenuToggle={() => setSidebarOpen((s) => !s)} />
      <ChatInterface
        sidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
      />
    </>
  )
}
