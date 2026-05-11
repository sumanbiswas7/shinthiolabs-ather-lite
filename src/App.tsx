import { useState } from "react";
import Navbar from "./components/Navbar/Navbar.tsx";
import ChatInterface from "./components/Chat/ChatInterface.tsx";
import "./styles/main.scss";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Navbar onMenuToggle={() => setSidebarOpen((s) => !s)} />
      <ChatInterface
        sidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
