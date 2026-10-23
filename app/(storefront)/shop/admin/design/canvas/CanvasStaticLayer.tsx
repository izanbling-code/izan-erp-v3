import CanvasElementRenderer from "./CanvasElementRenderer";
import type { CanvasElement } from "../types";

function css(elements: CanvasElement[]): string {
  return elements.filter(e => !e.hidden).map(el => {
    const f = el.frame;
    // Helper to generate CSS for tablet/mobile
    const bp = (o: any) => o
      ? `${o.x !== undefined ? `left:${o.x}px;` : ""}${o.y !== undefined ? `top:${o.y}px;` : ""}${o.width !== undefined ? `width:${o.width}px;` : ""}${o.height !== undefined ? `height:${o.height}px;` : ""}`
      : "";
      
    return `
      #el-${el.id} { 
        position: absolute;
        left:${f.x}px; 
        top:${f.y}px; 
        width:${f.width}px; 
        height:${f.height}px;
        transform:rotate(${f.rotation}deg); 
        z-index:${f.zIndex}; 
      }
      @media (max-width:1023px){ #el-${el.id} { ${bp(el.tablet)} } }
      @media (max-width:767px){ #el-${el.id} { ${bp(el.mobile)} } }
    `;
  }).join("\n");
}

export default function CanvasStaticLayer({
  elements = [], products = [],
}: { elements?: CanvasElement[]; products?: any[] }) {
  if (!elements.length) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css(elements) }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none", overflow: "hidden" }}>
        {elements.filter(e => !e.hidden).map(el => (
          <div
            key={el.id}
            id={`el-${el.id}`}
            // NOTE: The position is handled by the <style> block above
            style={{
              pointerEvents:
                el.type === "button" || el.type === "product-card" ? "auto" : "none",
            }}
          >
            <CanvasElementRenderer element={el} products={products} />
          </div>
        ))}
      </div>
    </>
  );
}