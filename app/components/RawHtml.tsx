"use client";

import { useEffect, useRef } from "react";

/**
 * Renders arbitrary HTML (e.g. from GrapesJS) safely in Next.js App Router.
 *
 * Why this exists: when you use `dangerouslySetInnerHTML` with HTML produced
 * by a third-party editor, the browser's HTML parser normalizes the string
 * (whitespace, entity encoding, self-closing tags, weird unicode) — producing
 * a DOM tree that doesn't match the string React compared on the server.
 * That causes "Hydration failed because the server rendered HTML didn't match
 * the client."
 *
 * Fix: server-render an empty placeholder, then set innerHTML imperatively
 * in useEffect after hydration. React never reconciles the injected subtree,
 * so mismatch is impossible.
 */
export default function RawHtml({
  html,
  className,
  style,
}: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Only overwrite if different — avoids pointless DOM churn on rerenders.
    if (ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      suppressHydrationWarning
    />
  );
}