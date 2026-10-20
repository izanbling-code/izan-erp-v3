"use client";

import React from "react";

// The GlobalShell now handles layout. This component is kept strictly to prevent breaking
// existing pages that import it, but it simply passes the content through cleanly.
export default function ERPShell({ title, children }: { title?: string, children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col relative z-10">
      {children}
    </div>
  );
}
