"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export function useShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        if (e.key === "Escape") target.blur();
        return;
      }

      // 1. GLOBAL NAVIGATION (Ctrl + Shift + Key)
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "d": e.preventDefault(); router.push("/"); toast.success("Dashboard"); break;
          case "s": e.preventDefault(); router.push("/purchases/suppliers"); toast.success("Suppliers"); break;
          case "c": e.preventDefault(); router.push("/sales/customers"); toast.success("Customers"); break;
          case "p": e.preventDefault(); router.push("/purchases/payables"); toast.success("Payables"); break;
          case "b": e.preventDefault(); router.push("/accounting/cashbook"); toast.success("Cash Book"); break;
          case "r": e.preventDefault(); router.push("/reports/view/bank-ledgers"); toast.success("Bank Ledgers"); break;
        }
        return;
      }

      // 2. HORIZONTAL TAB TOGGLER (ArrowLeft / ArrowRight)
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.ctrlKey && !e.altKey) {
        const tabs = Array.from(document.querySelectorAll("[data-tab]")) as HTMLElement[];
        if (tabs.length > 0) {
          e.preventDefault();
          const activeIndex = tabs.findIndex(t => t.classList.contains("active"));
          let newIndex = activeIndex === -1 ? 0 : activeIndex;
          
          if (e.key === "ArrowRight") newIndex = activeIndex < tabs.length - 1 ? activeIndex + 1 : activeIndex;
          if (e.key === "ArrowLeft") newIndex = activeIndex > 0 ? activeIndex - 1 : 0;
          
          tabs[newIndex].click();
          return;
        }
      }

      // 3. VERTICAL DATA GRID NAVIGATOR (ArrowUp / ArrowDown)
      const table = document.querySelector(".erp-data-table tbody");
      if (table && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const rows = Array.from(table.querySelectorAll("tr"));
          if (rows.length === 0) return;

          let currentIndex = rows.findIndex(r => r.classList.contains("keyboard-focus"));

          if (e.key === "ArrowDown") {
            currentIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : currentIndex === -1 ? 0 : currentIndex;
          } else {
            currentIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          }

          rows.forEach(r => r.classList.remove("keyboard-focus"));
          const targetRow = rows[currentIndex];
          targetRow.classList.add("keyboard-focus");
          targetRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
        }

        // 4. EXECUTE ROW DEFAULT ACTION (Enter)
        if (e.key === "Enter") {
          const focusedRow = table.querySelector("tr.keyboard-focus");
          if (focusedRow) {
            e.preventDefault();
            const actionBtn = focusedRow.querySelector("a, button") as HTMLElement;
            if (actionBtn) actionBtn.click();
            return;
          }
        }
      }

      // 5. CONTEXTUAL ACTIONS (Alt + Key)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        
        // Priority A: Check if a specific table row is highlighted and has a local shortcut
        const focusedRow = document.querySelector(".erp-data-table tr.keyboard-focus");
        if (focusedRow) {
          const rowAction = focusedRow.querySelector(`[data-row-shortcut="${key}"]`) as HTMLElement;
          if (rowAction) {
            e.preventDefault();
            rowAction.click();
            return;
          }
        }

        // Priority B: Check for global page shortcuts (e.g., Add Invoice)
        const pageAction = document.querySelector(`[data-shortcut="${key}"]`) as HTMLElement;
        if (pageAction) {
          e.preventDefault();
          pageAction.click();
          return;
        }
      }

      // 6. DYNAMIC HELP MENU (?)
      if (e.key === "?" && !e.ctrlKey && !e.altKey) {
        const localElements = document.querySelectorAll("[data-shortcut]");
        const localShortcuts = Array.from(localElements).map(el => {
          return { key: el.getAttribute("data-shortcut")?.toUpperCase(), label: el.textContent?.replace(/[^a-zA-Z\s]/g, '').trim() || "Action" };
        });

        toast((t) => (
          <div className="text-sm font-medium space-y-2">
            <p className="font-bold border-b pb-1 text-indigo-600">⌨️ Master Navigation</p>
            <div className="space-y-1 text-gray-700">
              <p><kbd className="bg-gray-100 border px-1 rounded">↑</kbd> <kbd className="bg-gray-100 border px-1 rounded">↓</kbd> : Navigate Rows</p>
              <p><kbd className="bg-gray-100 border px-1 rounded">←</kbd> <kbd className="bg-gray-100 border px-1 rounded">→</kbd> : Toggle Tabs</p>
              <p><kbd className="bg-gray-100 border px-1 rounded">Enter</kbd> : Open Selected</p>
            </div>
            
            {localShortcuts.length > 0 && (
              <>
                <p className="font-bold border-b pb-1 pt-2 text-emerald-600">📍 Page Actions</p>
                <div className="space-y-1 text-gray-700">
                  {localShortcuts.map((s, i) => (
                    <p key={i}><kbd className="bg-gray-100 border px-1 rounded">Alt</kbd> + <kbd className="bg-gray-100 border px-1 rounded">{s.key}</kbd> : {s.label}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        ), { duration: 6000, id: 'shortcut-toast' });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);
}