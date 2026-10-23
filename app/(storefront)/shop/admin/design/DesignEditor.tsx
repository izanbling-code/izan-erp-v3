"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, Copy, Eye, EyeOff, Save, ChevronRight,
  Palette, Layout, GripVertical, Monitor, Tablet, Smartphone,
  Undo2, Redo2, Loader2, Check, UploadCloud, LayoutTemplate
} from "lucide-react";
import CanvasLayer from "./canvas/CanvasLayer";
import ElementInspector from "./canvas/ElementInspector";
import SectionElementsPanel from "./canvas/SectionElementsPanel";
import { SECTION_REGISTRY, createSection, createElement } from "./registry";
import type {
  StorefrontSettingsV2,
  SectionConfig,
  TemplateKey,
  ThemeConfig,
  CanvasElement,
  ElementType,
} from "./types";
import SectionRenderer from "@/app/components/StorefrontSectionRenderer";
import SettingsPanel from "./SettingsPanel";
import ThemePanel from "./ThemePanel";
import { ZEMA_TEMPLATE } from "./templates/zema";
import { publishDesignAction, saveDraftAction } from "./actions";

type Viewport = "desktop" | "tablet" | "mobile";

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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // ---- history / undo-redo ----------------------------------------------
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
    setHistoryMeta({
      canUndo: true,
      canRedo: pointerRef.current < historyRef.current.length - 1,
    });
  };

  // ---- save (server action, replaces the old /api route) -----------------
  const isFirstRender = useRef(true);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveDesignAction(storefront);
      setSavedAt(Date.now());
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [storefront]);
  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      await saveDraftAction(storefront);
      setSavedAt(Date.now());
    } catch (e: any) {
      console.error("Save failed:", e);
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }, [storefront]);

  const publish = async () => {
    if (!confirm("Are you sure you want to publish these changes to the live site?")) return;
    setSaving(true);
    try {
      // 1. Save current state as draft
      await saveDraftAction(storefront);
      // 2. Publish draft to live
      const result = await publishDesignAction();
      if (!result.ok) throw new Error(result.error);
      alert("🎉 Site published successfully!");
    } catch (e: any) {
      console.error(e);
      alert("Publish failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- current template / selected things --------------------------------
  const template = storefront.templates[activeTemplate] ?? { sections: [] };
  const sections = template.sections;
  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;
  const selectedElement =
    selectedSection?.elements?.find((e) => e.id === selectedElementId) || null;

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

  // ---- section operations -------------------------------------------------
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
    setSelectedElementId(null);
    setShowThemePanel(false);
  };

  const removeSection = (id: string) => {
    updateTemplate((list) => list.filter((s) => s.id !== id));
    if (selectedSectionId === id) {
      setSelectedSectionId(null);
      setSelectedElementId(null);
    }
  };

  const duplicateSection = (id: string) => {
    const src = sections.find((s) => s.id === id);
    if (!src) return;
    const copy: SectionConfig = {
      ...src,
      id: Math.random().toString(36).slice(2, 10),
      blocks: src.blocks.map((b) => ({
        ...b,
        id: Math.random().toString(36).slice(2, 10),
      })),
      elements: (src.elements ?? []).map((e) => ({
        ...e,
        id: Math.random().toString(36).slice(2, 10),
        frame: { ...e.frame },
        style: { ...e.style },
        content: { ...e.content },
      })),
    };
    updateTemplate((list) => {
      const idx = list.findIndex((s) => s.id === id);
      const out = [...list];
      out.splice(idx + 1, 0, copy);
      return out;
    });
  };
    const applyZemaTemplate = () => {
    // Confirm so you don't accidentally overwrite your work
    if (confirm("Are you sure you want to load the Zema Template? This will overwrite your current layout.")) {
      commit({
        ...storefront,
        theme: ZEMA_TEMPLATE.theme as any,
        templates: ZEMA_TEMPLATE.templates as any,
      });
    }
  };

  const toggleSectionVisibility = (id: string) => {
    updateTemplate((list) =>
      list.map((s) => (s.id === id ? { ...s, disabled: !s.disabled } : s))
    );
  };

  const updateSectionSettings = (id: string, patch: Record<string, any>) => {
    updateTemplate((list) =>
      list.map((s) =>
        s.id === id ? { ...s, settings: { ...s.settings, ...patch } } : s
      )
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

  // ---- element operations -------------------------------------------------
  const addElement = (sectionId: string, type: ElementType) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const maxZ = Math.max(0, ...(sec.elements ?? []).map((e) => e.frame.zIndex));
    const el = createElement(type, {
      frame: { zIndex: maxZ + 1 } as CanvasElement["frame"],
    });
    updateTemplate((list) =>
      list.map((s) =>
        s.id === sectionId
          ? { ...s, elements: [...(s.elements ?? []), el] }
          : s
      )
    );
    setSelectedElementId(el.id);
  };

  const updateElement = (sectionId: string, updated: CanvasElement) => {
    updateTemplate((list) =>
      list.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              elements: (s.elements ?? []).map((e) =>
                e.id === updated.id ? updated : e
              ),
            }
          : s
      )
    );
  };

  const removeElement = (sectionId: string, elementId: string) => {
    updateTemplate((list) =>
      list.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              elements: (s.elements ?? []).filter((e) => e.id !== elementId),
            }
          : s
      )
    );
    if (selectedElementId === elementId) setSelectedElementId(null);
  };

  const duplicateElement = (sectionId: string, element: CanvasElement) => {
    const copy: CanvasElement = {
      ...element,
      id: Math.random().toString(36).slice(2, 10),
      frame: {
        ...element.frame,
        x: element.frame.x + 24,
        y: element.frame.y + 24,
        zIndex: element.frame.zIndex + 1,
      },
      style: { ...element.style },
      content: { ...element.content },
    };
    updateTemplate((list) =>
      list.map((s) =>
        s.id === sectionId
          ? { ...s, elements: [...(s.elements ?? []), copy] }
          : s
      )
    );
    setSelectedElementId(copy.id);
  };

  const toggleElementHidden = (sectionId: string, elementId: string) => {
    updateTemplate((list) =>
      list.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              elements: (s.elements ?? []).map((e) =>
                e.id === elementId ? { ...e, hidden: !e.hidden } : e
              ),
            }
          : s
      )
    );
  };

  // ---- drag-and-drop for section list -----------------------------------
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 text-zinc-100">
      {/* ---------------- header ---------------- */}
       <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider text-teal-400">
            DESIGN STUDIO
          </span>
          <select
            value={activeTemplate}
            onChange={(e) => {
              setActiveTemplate(e.target.value as TemplateKey);
              setSelectedSectionId(null);
              setSelectedElementId(null);
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
          {/* Undo / Redo */}
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

          {/* Viewport Toggles */}
          <button
            onClick={() => setViewport("desktop")}
            className={`p-2 rounded-lg transition ${
              viewport === "desktop"
                ? "bg-teal-500/20 text-teal-400"
                : "hover:bg-white/5"
            }`}
            title="Desktop"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport("tablet")}
            className={`p-2 rounded-lg transition ${
              viewport === "tablet"
                ? "bg-teal-500/20 text-teal-400"
                : "hover:bg-white/5"
            }`}
            title="Tablet"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`p-2 rounded-lg transition ${
              viewport === "mobile"
                ? "bg-teal-500/20 text-teal-400"
                : "hover:bg-white/5"
            }`}
            title="Mobile"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Save Status */}
          <div className="text-xs text-zinc-500 flex items-center gap-2 mr-2">
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : savedAt ? (
              <Check className="w-3 h-3 text-teal-400" />
            ) : null}
            {saving ? "Saving..." : savedAt ? "Saved to Draft" : "Unsaved"}
          </div>

          {/* Action Buttons */}
          <button
            onClick={applyZemaTemplate}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold transition"
            title="Load Zema Template"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Load Zema
          </button>

          <a
            href="/shop?preview=true"
            target="_blank"
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold transition"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </a>

          <button
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>

          <button
            onClick={publish}
            disabled={saving}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Publish
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ---------------- left: sections ---------------- */}
        <aside className="w-72 shrink-0 bg-zinc-900 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center gap-2">
            <button
              onClick={() => {
                setShowThemePanel(true);
                setSelectedSectionId(null);
                setSelectedElementId(null);
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
              const elementCount = sec.elements?.length ?? 0;
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
                    setSelectedElementId(null);
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
                  <span className="flex-1 truncate font-medium">
                    {sec.name}
                    {elementCount > 0 && (
                      <span className="ml-1 text-[10px] text-teal-400">
                        · {elementCount}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSectionVisibility(sec.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      {sec.disabled ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
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

        {/* ---------------- center: preview ---------------- */}
        <main className="flex-1 min-w-0 bg-zinc-950 overflow-auto p-6">
          <div
            className={`mx-auto bg-white shadow-2xl rounded-xl overflow-hidden transition-all duration-300 ${
              viewport === "mobile"
                ? "w-[420px]"
                : viewport === "tablet"
                ? "w-[768px]"
                : "w-full max-w-[1200px]"
            }`}
          >
            <PreviewFrame
              sections={sections}
              theme={storefront.theme}
              products={products}
              viewport={viewport}
              selectedSectionId={selectedSectionId}
              selectedElementId={selectedElementId}
              onSelectSection={(id) => {
                setSelectedSectionId(id);
                setSelectedElementId(null);
                setShowThemePanel(false);
              }}
              onSelectElement={(id) => setSelectedElementId(id)}
              onUpdateElement={updateElement}
            />
          </div>
        </main>

        {/* ---------------- right: inspector ---------------- */}
        <aside className="w-80 shrink-0 bg-zinc-900 border-l border-white/10 overflow-y-auto">
          {showThemePanel ? (
            <ThemePanel theme={storefront.theme} onChange={updateTheme} />
          ) : selectedElement && selectedSection ? (
            <ElementInspector
              element={selectedElement}
              viewport={viewport}
              products={products}
              onChange={(el) => updateElement(selectedSection.id, el)}
              onDelete={() =>
                removeElement(selectedSection.id, selectedElement.id)
              }
              onDuplicate={() =>
                duplicateElement(selectedSection.id, selectedElement)
              }
            />
          ) : selectedSection ? (
            <>
              <SettingsPanel
                section={selectedSection}
                schema={SECTION_REGISTRY[selectedSection.type]}
                onChange={(patch) =>
                  updateSectionSettings(selectedSection.id, patch)
                }
                onBlocksChange={(blocks) =>
                  updateTemplate((list) =>
                    list.map((s) =>
                      s.id === selectedSection.id ? { ...s, blocks } : s
                    )
                  )
                }
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
              />
              <SectionElementsPanel
                section={selectedSection}
                onAdd={(t) => addElement(selectedSection.id, t)}
                onSelect={(id) => setSelectedElementId(id)}
                onRemove={(id) => removeElement(selectedSection.id, id)}
                onToggleHidden={(id) =>
                  toggleElementHidden(selectedSection.id, id)
                }
              />
            </>
          ) : (
            <EmptyState />
          )}
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Sub components                              */
/* -------------------------------------------------------------------------- */

function AddSectionMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories = Array.from(
    new Set(Object.values(SECTION_REGISTRY).map((s) => s.category))
  );

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
  viewport,
  selectedSectionId,
  selectedElementId,
  onSelectSection,
  onSelectElement,
  onUpdateElement,
}: {
  sections: SectionConfig[];
  theme: ThemeConfig;
  products: ProductLite[];
  viewport: Viewport;
  selectedSectionId: string | null;
  selectedElementId: string | null;
  onSelectSection: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (sectionId: string, el: CanvasElement) => void;
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

  const visible = sections.filter((s) => !s.disabled);

  return (
    <div style={cssVars} className="bg-[var(--theme-bg)] text-[var(--theme-text)]">
      {visible.map((sec) => (
        <div key={sec.id} className="relative">
          {/* Section content (clickable to select the section) */}
          <div
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
            <SectionRenderer section={sec} products={products} storeName="YOUR_STORE_NAME" />
          </div>

          {/* Canvas overlay (element interactions handled by react-rnd) */}
          <CanvasLayer
            elements={sec.elements ?? []}
            products={products}
            viewport={viewport}
            selectedElementId={
              selectedSectionId === sec.id ? selectedElementId : null
            }
            onSelect={(id) => {
              onSelectSection(sec.id);
              onSelectElement(id);
            }}
            onChange={(el) => onUpdateElement(sec.id, el)}
          />
        </div>
      ))}

      {visible.length === 0 && (
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
        or click <span className="text-teal-400">Theme settings</span> to
        customize global colors and fonts.
      </p>
    </div>
  );
}

function saveDesignAction(storefront: StorefrontSettingsV2) {
  throw new Error("Function not implemented.");
}
