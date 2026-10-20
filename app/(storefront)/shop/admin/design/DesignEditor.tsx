"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Save,
  ChevronDown,
  ChevronRight,
  Palette,
  Layout,
  GripVertical,
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
  Loader2,
  Check,
} from "lucide-react";
import type {
  StorefrontSettingsV2,
  SectionConfig,
  TemplateKey,
  ThemeConfig,
} from "./types";
import { SECTION_REGISTRY, createSection } from "./registry";
import SectionRenderer from "@/app/components/StorefrontSectionRenderer";
import SettingsPanel from "./SettingsPanel";
import ThemePanel from "./ThemePanel";

interface ProductLite {
  id: string;
  name: string;
  salePrice: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
}

interface Props {
  initialStorefront: StorefrontSettingsV2;
  products: ProductLite[];
}

export default function DesignEditor({ initialStorefront, products }: Props) {
  const [storefront, setStorefront] = useState<StorefrontSettingsV2>(initialStorefront);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>("index");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const historyRef = useRef<StorefrontSettingsV2[]>([initialStorefront]);
  const pointerRef = useRef(0);
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  const commit = useCallback((next: StorefrontSettingsV2) => {
    setStorefront(next);
    const stack = historyRef.current.slice(0, pointerRef.current + 1);
    stack.push(next);
    if (stack.length > 50) stack.shift();
    historyRef.current = stack;
    pointerRef.current = stack.length - 1;
    setHistoryMeta({ canUndo: pointerRef.current > 0, canRedo: false });
  }, []);

  const undo = () => {
    if (pointerRef.current === 0) return;
    pointerRef.current -= 1;
    setStorefront(historyRef.current[pointerRef.current]);
    setHistoryMeta({ canUndo: pointerRef.current > 0, canRedo: true });
  };
  const redo = () => {
    if (pointerRef.current >= historyRef.current.length - 1) return;
    pointerRef.current += 1;
    setStorefront(historyRef.current[pointerRef.current]);
    setHistoryMeta({ canUndo: true, canRedo: pointerRef.current < historyRef.current.length - 1 });
  };

  const isFirstRender = useRef(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/storefront/design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: storefront }),
      });

      const text = await res.text();
      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        console.error("Non-JSON response:", {
          status: res.status,
          contentType,
          preview: text.slice(0, 300),
        });
        throw new Error(`API returned ${res.status} (${contentType})`);
      }

      const json = JSON.parse(text);
      if (!json.ok) throw new Error(json.error || "Save failed");
      setSavedAt(Date.now());
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [storefront]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save();
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [storefront, save]);

  const template = storefront.templates[activeTemplate] ?? { sections: [] };
  const sections = template.sections;
  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;

  const updateTemplate = (fn: (sections: SectionConfig[]) => SectionConfig[]) => {
    const next = {
      ...storefront,
      templates: {
        ...storefront.templates,
        [activeTemplate]: { ...template, sections: fn(template.sections) },
      },
    };
    commit(next);
  };

  const addSection = (type: string, afterId?: string) => {
    const sec = createSection(type);
    updateTemplate((list) => {
      if (!afterId) return [...list, sec];
      const idx = list.findIndex((s) => s.id === afterId);
      const copy = [...list];
      copy.splice(idx + 1, 0, sec);
      return copy;
    });
    setSelectedSectionId(sec.id);
    setShowThemePanel(false);
  };

  const removeSection = (id: string) => {
    updateTemplate((list) => list.filter((s) => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  };

  const duplicateSection = (id: string) => {
    const src = sections.find((s) => s.id === id);
    if (!src) return;
    const copy: SectionConfig = {
      ...src,
      id: Math.random().toString(36).slice(2, 10),
      blocks: src.blocks.map((b) => ({ ...b, id: Math.random().toString(36).slice(2, 10) })),
    };
    updateTemplate((list) => {
      const idx = list.findIndex((s) => s.id === id);
      const out = [...list];
      out.splice(idx + 1, 0, copy);
      return out;
    });
  };

  const toggleSectionVisibility = (id: string) => {
    updateTemplate((list) =>
      list.map((s) => (s.id === id ? { ...s, disabled: !s.disabled } : s))
    );
  };

  const updateSectionSettings = (id: string, patch: Record<string, any>) => {
    updateTemplate((list) =>
      list.map((s) => (s.id === id ? { ...s, settings: { ...s.settings, ...patch } } : s))
    );
  };

  const reorderSections = (fromIdx: number, toIdx: number) => {
    updateTemplate((list) => {
      const copy = [...list];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const updateTheme = (next: ThemeConfig) => {
    commit({ ...storefront, theme: next });
  };

  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 text-zinc-100">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider text-teal-400">DESIGN STUDIO</span>
          <select
            value={activeTemplate}
            onChange={(e) => {
              setActiveTemplate(e.target.value as TemplateKey);
              setSelectedSectionId(null);
            }}
            className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <option value="index">Home page</option>
            <option value="product">Product page</option>
            <option value="collection">Collection page</option>
            <option value="page">Generic page</option>
            <option value="cart">Cart page</option>
            <option value="notFound">404 page</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!historyMeta.canUndo}
            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!historyMeta.canRedo}
            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button
            onClick={() => setViewport("desktop")}
            className={`p-2 rounded-lg transition ${
              viewport === "desktop" ? "bg-teal-500/20 text-teal-400" : "hover:bg-white/5"
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`p-2 rounded-lg transition ${
              viewport === "mobile" ? "bg-teal-500/20 text-teal-400" : "hover:bg-white/5"
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <div className="text-xs text-zinc-500 flex items-center gap-2 mr-2">
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : savedAt ? (
              <Check className="w-3 h-3 text-teal-400" />
            ) : null}
            {saving ? "Saving..." : savedAt ? "Saved" : "Unsaved"}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 bg-zinc-900 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center gap-2">
            <button
              onClick={() => {
                setShowThemePanel(true);
                setSelectedSectionId(null);
              }}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                showThemePanel
                  ? "bg-teal-500/20 text-teal-400"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Theme settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {sections.map((sec, idx) => {
              const isSelected = sec.id === selectedSectionId && !showThemePanel;
              const isDragOver = dragOverIdx === idx;
              return (
                <div
                  key={sec.id}
                  draggable
                  onDragStart={() => {
                    dragIdx.current = idx;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIdx(idx);
                  }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => {
                    if (dragIdx.current !== null && dragIdx.current !== idx) {
                      reorderSections(dragIdx.current, idx);
                    }
                    dragIdx.current = null;
                    setDragOverIdx(null);
                  }}
                  onClick={() => {
                    setSelectedSectionId(sec.id);
                    setSelectedBlockId(null);
                    setShowThemePanel(false);
                  }}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-teal-500/20 text-teal-100 border border-teal-500/40"
                      : isDragOver
                      ? "bg-white/10 border border-teal-500/60"
                      : "hover:bg-white/5 border border-transparent"
                  } ${sec.disabled ? "opacity-40" : ""}`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="flex-1 truncate font-medium">{sec.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionVisibility(sec.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      {sec.disabled ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSection(sec.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSection(sec.id);
                      }}
                      className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            <AddSectionMenu onAdd={(type) => addSection(type)} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-zinc-950 overflow-auto p-6">
          <div
            className={`mx-auto bg-white shadow-2xl rounded-xl overflow-hidden transition-all duration-300 ${
              viewport === "mobile" ? "w-[420px]" : "w-full max-w-[1200px]"
            }`}
          >
            <PreviewFrame
              sections={sections}
              theme={storefront.theme}
              products={products}
              selectedSectionId={selectedSectionId}
              onSelectSection={(id) => {
                setSelectedSectionId(id);
                setShowThemePanel(false);
              }}
            />
          </div>
        </main>

        <aside className="w-80 shrink-0 bg-zinc-900 border-l border-white/10 overflow-y-auto">
          {showThemePanel ? (
            <ThemePanel theme={storefront.theme} onChange={updateTheme} />
          ) : selectedSection ? (
            <SettingsPanel
              section={selectedSection}
              schema={SECTION_REGISTRY[selectedSection.type]}
              onChange={(patch) => updateSectionSettings(selectedSection.id, patch)}
              onBlocksChange={(blocks) =>
                updateTemplate((list) =>
                  list.map((s) => (s.id === selectedSection.id ? { ...s, blocks } : s))
                )
              }
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
            />
          ) : (
            <EmptyState />
          )}
        </aside>
      </div>
    </div>
  );
}

function AddSectionMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories = Array.from(new Set(Object.values(SECTION_REGISTRY).map((s) => s.category)));

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/20 hover:border-teal-500/60 hover:bg-teal-500/5 text-xs font-semibold text-zinc-400 hover:text-teal-400 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Add section
      </button>
      {open && (
        <div className="mt-2 bg-zinc-800 border border-white/10 rounded-lg overflow-hidden">
          {categories.map((cat) => (
            <div key={cat} className="border-b border-white/5 last:border-0">
              <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                {cat}
              </div>
              {Object.values(SECTION_REGISTRY)
                .filter((s) => s.category === cat)
                .map((s) => (
                  <button
                    key={s.type}
                    onClick={() => {
                      onAdd(s.type);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition"
                  >
                    {s.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewFrame({
  sections,
  theme,
  products,
  selectedSectionId,
  onSelectSection,
}: {
  sections: SectionConfig[];
  theme: ThemeConfig;
  products: ProductLite[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
}) {
  const cssVars = {
    "--theme-primary": theme.colors.primary,
    "--theme-secondary": theme.colors.secondary,
    "--theme-accent": theme.colors.accent,
    "--theme-bg": theme.colors.background,
    "--theme-surface": theme.colors.surface,
    "--theme-text": theme.colors.text,
    "--theme-text-muted": theme.colors.textMuted,
    "--theme-border": theme.colors.border,
    "--theme-radius": theme.borderRadius,
    "--theme-heading-font": theme.typography.headingFont,
    "--theme-body-font": theme.typography.bodyFont,
    "--theme-base-size": theme.typography.baseFontSize,
    "--theme-heading-weight": theme.typography.headingWeight,
  } as React.CSSProperties;

  return (
    <div
      style={cssVars}
      className="bg-[var(--theme-bg)] text-[var(--theme-text)]"
    >
      {sections
        .filter((s) => !s.disabled)
        .map((sec) => (
          <div
            key={sec.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSection(sec.id);
            }}
            className={`relative cursor-pointer transition-all ${
              selectedSectionId === sec.id
                ? "ring-2 ring-teal-500 ring-offset-0"
                : "hover:ring-1 hover:ring-teal-500/40"
            }`}
          >
            {selectedSectionId === sec.id && (
              <div className="absolute top-0 left-0 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider z-10 rounded-br">
                {sec.name}
              </div>
            )}
            <SectionRenderer section={sec} products={products} />
          </div>
        ))}

      {sections.filter((s) => !s.disabled).length === 0 && (
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-8 py-24">
          <Layout className="w-12 h-12 text-zinc-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start designing</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            Add sections from the left panel to build your storefront.
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-6 text-center">
      <ChevronRight className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
      <p className="text-xs text-zinc-500 leading-relaxed">
        Select a section in the preview
        <br />
        to edit its settings,
        <br />
        or click <span className="text-teal-400">Theme settings</span> to customize global colors
        and fonts.
      </p>
    </div>
  );
}