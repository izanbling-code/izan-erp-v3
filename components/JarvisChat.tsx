"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Maximize2, Minimize2, ExternalLink, Trash2 } from "lucide-react";

export default function JarvisChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");

  // ✅ Load messages from localStorage on first render
  const [messages, setMessages] = useState<{role: string, text: string}[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jarvis_chat_history");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse chat history");
        }
      }
    }
    return [{ role: "ai", text: "Hello! I am Jarvis. How can I help you manage your business today?" }];
  });

  // ✅ Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("jarvis_chat_history", JSON.stringify(messages));
  }, [messages]);

  // --- Window Dragging Logic ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMaximized) return; 
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // --- Chat Logic ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // ✅ Add a timeout so it doesn't spin forever (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: controller.signal, // Attach abort signal
      });
      
      clearTimeout(timeoutId); // Clear timer if fetch completes

      const rawText = await res.text();
      
      // ✅ Safely parse JSON (Catches HTML error pages)
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("Server returned non-JSON:", rawText);
        throw new Error(`Server crashed (Status: ${res.status}). Check browser console.`);
      }

      if (!res.ok) throw new Error(data.error || "Failed to get response from server");
      if (!data.reply) throw new Error("The AI returned an empty response.");
      
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages((prev) => [...prev, { role: "ai", text: "Request timed out. The AI might be stuck in a loop or hitting rate limits. Please try again." }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: `Error: ${error.message}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if(confirm("Are you sure you want to clear the chat history?")) {
      setMessages([{ role: "ai", text: "Hello! I am Jarvis. How can I help you today?" }]);
    }
  };

  const toggleMaximize = () => {
    if (!isMaximized) setPosition({ x: 0, y: 0 });
    setIsMaximized(!isMaximized);
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999999, display: "flex", flexDirection: "column", alignItems: "flex-end", pointerEvents: "none" }}>
      
      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            pointerEvents: "auto",
            position: isMaximized ? "fixed" : "relative",
            top: isMaximized ? "50%" : "auto",
            left: isMaximized ? "50%" : "auto",
            transform: isMaximized ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` : "none",
            width: isMaximized ? "800px" : "380px",
            height: isMaximized ? "80vh" : "550px",
            maxWidth: "95vw",
            maxHeight: "90vh",
            resize: "both",
            overflow: "auto",
            backgroundColor: "rgba(24, 24, 27, 0.6)", 
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            marginBottom: isMaximized ? "0" : "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            zIndex: 10000
          }}
        >
          {/* Header */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: "16px",
              backgroundColor: "rgba(39, 39, 42, 0.5)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "white",
              fontWeight: "bold",
              cursor: isMaximized ? "grab" : "default",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", backgroundColor: "rgba(20, 184, 166, 0.2)", color: "#14b8a6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles style={{ width: "14px", height: "14px" }} />
              </div>
              Jarvis AI
            </div>
            
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={clearChat} title="Clear Chat" style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                <Trash2 style={{ width: "16px", height: "16px" }} />
              </button>
              <button onClick={() => window.open("/chat", "_blank")} title="Open in New Tab" style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                <ExternalLink style={{ width: "16px", height: "16px" }} />
              </button>
              <button onClick={toggleMaximize} title="Toggle Window" style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                {isMaximized ? <Minimize2 style={{ width: "16px", height: "16px" }} /> : <Maximize2 style={{ width: "16px", height: "16px" }} />}
              </button>
              <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                <X style={{ width: "20px", height: "20px" }} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", maxWidth: "85%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: msg.role === "user" ? "#4f46e5" : "rgba(20, 184, 166, 0.2)", color: msg.role === "user" ? "white" : "#14b8a6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", flexShrink: 0 }}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div style={{ padding: "10px 14px", backgroundColor: msg.role === "user" ? "#4f46e5" : "rgba(255, 255, 255, 0.05)", color: "white", border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.05)" : "none", borderRadius: "12px", borderBottomRightRadius: msg.role === "user" ? "2px" : "12px", borderBottomLeftRadius: msg.role === "ai" ? "2px" : "12px", fontSize: "13px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", gap: "8px", maxWidth: "85%", alignSelf: "flex-start" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(20, 184, 166, 0.2)", color: "#14b8a6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>AI</div>
                <div style={{ padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.05)", color: "#a1a1aa", borderRadius: "12px", borderBottomLeftRadius: "2px", fontSize: "13px", fontStyle: "italic" }}>Jarvis is typing...</div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ padding: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", gap: "8px", backgroundColor: "rgba(39, 39, 42, 0.5)", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px" }}>
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading}
              placeholder={isLoading ? "Jarvis is thinking..." : "Ask Jarvis..." }
              style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "20px", padding: "10px 16px", fontSize: "13px", color: "white", outline: "none", opacity: isLoading ? 0.6 : 1 }}
            />
            <button type="submit" disabled={!input.trim() || isLoading} style={{ width: "40px", height: "40px", backgroundColor: input.trim() && !isLoading ? "#14b8a6" : "#3f3f46", border: "none", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !isLoading ? "pointer" : "not-allowed" }}>
              <Send style={{ width: "16px", height: "16px" }} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{ pointerEvents: "auto", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#14b8a6", color: "white", border: "none", cursor: "pointer", boxShadow: "0 10px 25px rgba(20, 184, 166, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s" }}
        >
          <Sparkles style={{ width: "24px", height: "24px" }} />
        </button>
      )}

    </div>
  );
}