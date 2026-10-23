"use client";

import React from "react";
import Sidebar from "./Sidebar";
import JarvisChat from "./JarvisChat";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  console.log("🚨 GLOBAL SHELL IS RENDERING RIGHT NOW!");
  
  const { config: appearanceConfig } = useERPConfig("appearance");
  // ... rest of the code
  const isCompact = appearanceConfig?.dataDensity === "compact";
  const paddingClass = isCompact ? "p-4" : "p-8";

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-300 font-sans antialiased transition-colors duration-300">
      
      <Sidebar />
      
      <main className="flex-1 h-full overflow-y-auto relative custom-scrollbar">
        <div className={`max-w-[1600px] mx-auto w-full relative z-10 ${paddingClass}`}>
          {children}
        </div>
      </main>

      {/* 👇 HARDCODED TEST BOX 👇 */}
      <div style={{ position: 'fixed', bottom: '10px', left: '300px', zIndex: 999999, background: 'green', color: 'white', padding: '30px', fontSize: '20px' }}>
        GREEN GLOBAL SHELL TEST
      </div>

      <JarvisChat />
      
    </div>
  );
}