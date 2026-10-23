"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SectionConfig } from "@/app/(storefront)/shop/admin/design/types";

const STORAGE_KEY = "izan_funnel_seen_v1";

export default function StorefrontWelcomeFunnel({
  section,
  quizData,
  onComplete,
}: {
  section: SectionConfig;
  quizData: any;
  onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    onComplete?.();
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

    useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto"; // <--- FORCE UNLOCK
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const quizQuestions = Array.isArray(quizData?.questions) ? quizData.questions : [];

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome experience"
    >
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl ring-1 ring-white/10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Welcome</p>
                <h2 className="mt-2 text-2xl font-bold">{section?.name || "Your store is ready"}</h2>
              </div>
              <button
                onClick={dismiss}
                aria-label="Close welcome dialog"
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              {quizData?.intro || "Start your storefront journey and explore what you can customize."}
            </p>

            {quizQuestions.length > 0 && (
              <div className="mt-6 space-y-3">
                {quizQuestions.slice(0, 3).map((question: any, index: number) => (
                  <div key={question?.id || index} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    {question?.prompt || `Question ${index + 1}`}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={dismiss}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Skip
              </button>
              <button
                onClick={dismiss}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}