"use client";

import { Rnd } from "react-rnd";
import CanvasElementRenderer from "./CanvasElementRenderer";
import type { CanvasElement } from "../types";

type Viewport = "desktop" | "tablet" | "mobile";

interface Props {
  elements: CanvasElement[];
  products: any[];
  viewport: Viewport;
  selectedElementId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (el: CanvasElement) => void;
}

function getFrame(el: CanvasElement, vp: Viewport) {
  if (vp === "mobile" && el.mobile) return { ...el.frame, ...el.mobile };
  if (vp === "tablet" && el.tablet) return { ...el.frame, ...el.tablet };
  return el.frame;
}

function writeFrame(el: CanvasElement, vp: Viewport, patch: Partial<CanvasElement["frame"]>): CanvasElement {
  if (vp === "desktop") return { ...el, frame: { ...el.frame, ...patch } };
  const slot = vp === "mobile" ? "mobile" : "tablet";
  return { ...el, [slot]: { ...(el[slot] as any ?? {}), ...patch } };
}

const handleStyle = {
  width: '12px',
  height: '12px',
  background: 'white',
  border: '2px solid #14b8a6',
  borderRadius: '50%',
  zIndex: 20,
};

export default function CanvasLayer({
  elements, products, viewport, selectedElementId, onSelect, onChange,
}: Props) {
  return (
    <div style={{ 
      position: "absolute", 
      inset: 0, 
      zIndex: 100,
      // ADDED: Visual 10x10px grid background
      backgroundImage: "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
      backgroundSize: "10px 10px"
    }}>
      {elements.filter(e => !e.hidden).map(el => {
        const f = getFrame(el, viewport);
        const selected = selectedElementId === el.id;
        return (
          <Rnd
            key={el.id}
            bounds="parent"
            position={{ x: f.x, y: f.y }}
            size={{ width: f.width, height: f.height }}
            disableDragging={el.locked}
            enableResizing={!el.locked}
            
            // ADDED: Snap to 10px grid when dragging and resizing
            dragGrid={[10, 10]} 
            resizeGrid={[10, 10]}
            // ADDED: Snap to other elements within 10px
            snapGap={10} 
            
            resizeHandleStyles={{
              topLeft: handleStyle,
              topRight: handleStyle,
              bottomLeft: handleStyle,
              bottomRight: handleStyle,
            }}
            onMouseDown={() => onSelect(el.id)} 
            onDragStop={(_e, d) => onChange(writeFrame(el, viewport, { x: d.x, y: d.y }))}
            onResizeStop={(_e, _dir, ref, _delta, pos) =>
              onChange(writeFrame(el, viewport, {
                x: pos.x, y: pos.y,
                width: parseFloat(ref.style.width),
                height: parseFloat(ref.style.height),
              }))
            }
            style={{
              zIndex: f.zIndex,
              outline: selected ? "2px solid #14b8a6" : "1px dashed rgba(20, 184, 166, 0.3)",
            }}
          >
            <div 
              style={{ 
                width: "100%", 
                height: "100%", 
                cursor: el.locked ? "default" : "move",
                display: 'flex' 
              }}
            >
              <div style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                <CanvasElementRenderer element={el} products={products} />
              </div>
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}