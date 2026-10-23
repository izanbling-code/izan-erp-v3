"use client";

import { useState } from "react";
import { Sparkles, Send, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function JarvisStandalone() {
  const [messages, setMessages] = useState([{ role: "ai", text: "Hello! I am Jarvis. How can I help you manage your business today?" }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = { role: "user", text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: "ai", text: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[90vh] bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-lg transition text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-white font-bold">
              <Sparkles className="w-5 h-5 text-teal-400" /> Jarvis AI (Full Screen)
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === "user" ? "bg-indigo-500 text-white" : "bg-teal-500/20 text-teal-400"}`}>
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-500 text-white rounded-tr-sm" : "bg-white/10 text-zinc-200 rounded-tl-sm"}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">AI</div>
              <div className="p-4 rounded-2xl bg-white/5 text-zinc-400 italic text-sm">Jarvis is typing...</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading}
              placeholder="Ask Jarvis anything..." 
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-teal-500"
            />
            <button type="submit" disabled={!input.trim() || isLoading} className="bg-teal-500 hover:bg-teal-400 text-white px-6 rounded-xl font-bold transition disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}