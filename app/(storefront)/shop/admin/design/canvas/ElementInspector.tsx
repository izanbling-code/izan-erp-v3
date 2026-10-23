"use client";

import { Trash2, Copy, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { ELEMENT_REGISTRY, FONT_LIBRARY } from "../registry";
import { ICON_NAMES } from "./ElementIcons";
import type { CanvasElement, ElementType } from "../types";

type Viewport = "desktop" | "tablet" | "mobile";

interface Props {
  element: CanvasElement;
  viewport: Viewport;
  products: { id: string; name: string }[];
  onChange: (el: CanvasElement) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function ElementInspector({
  element, viewport, products, onChange, onDelete, onDuplicate,
}: Props) {
  const patch = (p: Partial<CanvasElement>) => onChange({ ...element, ...p });
  const patchStyle = (p: Partial<CanvasElement["style"]>) =>
    onChange({ ...element, style: { ...element.style, ...p } });
  const patchContent = (p: Record<string, any>) =>
    onChange({ ...element, content: { ...element.content, ...p } });

  // For viewport-specific frames, write to the right slot
  const f = (viewport === "desktop" ? element.frame
          : (element[viewport] as any) ?? element.frame);

  const setFrame = (key: "x" | "y" | "width" | "height", v: number) => {
    if (viewport === "desktop") onChange({ ...element, frame: { ...element.frame, [key]: v } });
    else onChange({ ...element, [viewport]: { ...(element[viewport] as any ?? {}), [key]: v } } as any);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-teal-400">
          {ELEMENT_REGISTRY[element.type as ElementType].label}
        </div>
        <div className="flex gap-1">
          <button onClick={() => patch({ locked: !element.locked })}
            className="p-1.5 rounded hover:bg-white/10">
            {element.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => patch({ hidden: !element.hidden })}
            className="p-1.5 rounded hover:bg-white/10">
            {element.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDuplicate} className="p-1.5 rounded hover:bg-white/10">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded text-rose-400 hover:bg-rose-500/20">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-zinc-500">
        {viewport} frame
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(["x","y","width","height"] as const).map(k => (
          <label key={k} className="text-[11px]">
            <span className="text-zinc-500">{k}</span>
            <input type="number" value={Math.round(f[k] ?? 0)}
              onChange={e => setFrame(k, Number(e.target.value))}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">
          <span className="text-zinc-500">z-index</span>
          <input type="number" value={element.frame.zIndex}
            onChange={e => patch({ frame: { ...element.frame, zIndex: Number(e.target.value) } })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" />
        </label>
        <label className="text-[11px]">
          <span className="text-zinc-500">rotation°</span>
          <input type="number" value={element.frame.rotation}
            onChange={e => patch({ frame: { ...element.frame, rotation: Number(e.target.value) } })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" />
        </label>
      </div>

      <hr className="border-white/10" />

      {/* Type-specific content */}
      {element.type === "text" && (
        <label className="block text-[11px]">
          <span className="text-zinc-500">Text</span>
          <textarea value={element.content.text ?? ""}
            onChange={e => patchContent({ text: e.target.value })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs min-h-[60px]" />
        </label>
      )}
      {element.type === "button" && (
        <>
          <label className="block text-[11px]"><span className="text-zinc-500">Label</span>
            <input value={element.content.label ?? ""} onChange={e => patchContent({ label: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" /></label>
          <label className="block text-[11px]"><span className="text-zinc-500">Href</span>
            <input value={element.content.href ?? ""} onChange={e => patchContent({ href: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" /></label>
        </>
      )}
      

      {element.type === "button" && (
        <>
          <label className="block text-[11px]"><span className="text-zinc-500">Label</span>
            <input value={element.content.label ?? ""} onChange={e => patchContent({ label: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" /></label>
          <label className="block text-[11px]"><span className="text-zinc-500">Href (Link)</span>
            <input value={element.content.href ?? ""} onChange={e => patchContent({ href: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" placeholder="/shop/cart" /></label>
          
          {/* ADDED: Icon picker for buttons */}
          <label className="block text-[11px]"><span className="text-zinc-500">Button Icon (Optional)</span>
            <select value={element.content.iconName ?? ""}
              onChange={e => patchContent({ iconName: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
              <option value="">None</option>
              {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select></label>
        </>
      )}

      {element.type === "icon" && (
        <>
          <label className="block text-[11px]"><span className="text-zinc-500">Icon</span>
            <select value={element.content.iconName}
              onChange={e => patchContent({ iconName: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
              {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select></label>
            
          {/* ADDED: Link for icons */}
          <label className="block text-[11px]"><span className="text-zinc-500">Href (Link - Optional)</span>
            <input value={element.content.href ?? ""} onChange={e => patchContent({ href: e.target.value })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" placeholder="/shop/cart" /></label>
        </>
      )}
      {element.type === "image" && (
        <label className="block text-[11px]"><span className="text-zinc-500">Image URL</span>
          <input value={element.content.url ?? ""} onChange={e => patchContent({ url: e.target.value })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" /></label>
      )}
      {element.type === "shape" && (
        <label className="block text-[11px]"><span className="text-zinc-500">Shape</span>
          <select value={element.content.shape} onChange={e => patchContent({ shape: e.target.value })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
          </select></label>
      )}
      {element.type === "product-card" && (
        <label className="block text-[11px]"><span className="text-zinc-500">Product</span>
          <select value={element.content.productId ?? ""}
            onChange={e => patchContent({ productId: e.target.value })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
            <option value="">— Select —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
      )}

      <hr className="border-white/10" />

      {/* Style: color + font for text/button */}
      {(element.type === "text" || element.type === "button") && (
        <label className="block text-[11px]"><span className="text-zinc-500">Font family</span>
          <select value={element.style.fontFamily ?? ""}
            onChange={e => patchStyle({ fontFamily: e.target.value })}
            className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
            <option value="">Default</option>
            {FONT_LIBRARY.map(f => <option key={f.value} value={f.value}>{f.family}</option>)}
          </select></label>
      )}

      {(element.type === "text" || element.type === "icon" || element.type === "button") && (
        <label className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Color</span>
          <input type="color" value={element.style.color ?? "#000000"}
            onChange={e => patchStyle({ color: e.target.value })}
            className="w-12 h-7 bg-transparent rounded border border-white/10" />
        </label>
      )}

      {(element.type === "shape" || element.type === "button" || element.type === "divider") && (
        <label className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Background</span>
          <input type="color" value={element.style.background ?? "#14b8a6"}
            onChange={e => patchStyle({ background: e.target.value })}
            className="w-12 h-7 bg-transparent rounded border border-white/10" />
        </label>
      )}

      {(element.type === "text" || element.type === "button") && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]"><span className="text-zinc-500">Font size</span>
            <input type="number" value={element.style.fontSize ?? 16}
              onChange={e => patchStyle({ fontSize: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs" /></label>
          <label className="text-[11px]"><span className="text-zinc-500">Weight</span>
            <select value={String(element.style.fontWeight ?? 400)}
              onChange={e => patchStyle({ fontWeight: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs">
              {[300,400,500,600,700,800].map(w => <option key={w} value={w}>{w}</option>)}
            </select></label>
        </div>
      )}

      <label className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">Opacity</span>
        <input type="range" min={0} max={1} step={0.05}
          value={element.style.opacity ?? 1}
          onChange={e => patchStyle({ opacity: Number(e.target.value) })}
          className="w-32" />
      </label>
    </div>
  );
}