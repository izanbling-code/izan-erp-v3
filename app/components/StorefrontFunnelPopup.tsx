"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import StorefrontExperience from "@/app/components/StorefrontExperience";

const STORAGE_KEY = "izan_funnel_seen_v1";

export default function StorefrontFunnelPopup({
  quizData,
  fallbackProducts = [],
}: {
  section?: any;
  quizData: any;
  fallbackProducts?: any[];
  onComplete?: () => void;
}): import("react").JSX.Element | null {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage disabled */
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome experience"
    >
      {/* Full-screen experience */}
      <div className="absolute inset-0 overflow-y-auto">
        <StorefrontExperience
          quizData={quizData}
          fallbackProducts={fallbackProducts}
        />
      </div>

      {/* Floating close button — stays pinned top-right even while scrolling */}
      <button
        onClick={dismiss}
        aria-label="Close"
        className="fixed right-5 top-5 z-10 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/80 backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/20 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
        Skip
      </button>
    </div>
  );
}