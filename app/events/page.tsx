"use client";

import React, { useState, useEffect } from "react";

type EventItem = { id: string; name: string; quantity: number; unitCost: number; };
type EventExpense = { id: string; description: string; amount: number; };
type EventSaleItem = { id: string; itemId: string; quantity: number; unitPrice: number; totalPrice: number; };
type EventSale = { id: string; customerName?: string; customerPhone?: string; totalAmount: number; paymentMethod: string; createdAt: string; items: EventSaleItem[]; };
type EventPlanner = { id: string; name: string; location: string; eventDate: string; status: string; items: EventItem[]; expenses: EventExpense[]; sales: EventSale[]; };

const mobileStyles = `
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .layout-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 32px; }
  .pos-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
  .table-container { width: 100%; overflow-x: auto; }
  @media (max-width: 1024px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .layout-grid { grid-template-columns: 1fr; }
    .pos-grid { grid-template-columns: 1fr; display: flex; flex-direction: column-reverse; }
  }
  @media (max-width: 600px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .tab-menu { flex-direction: column; align-items: flex-start; gap: 8px; }
    .tab-menu button { width: 100%; text-align: left; padding: 12px !important; }
  }
`;

export default function EventSandboxPage() {
  const [events, setEvents] = useState<EventPlanner[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventPlanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"LIST" | "DETAIL">("LIST");
  const [tab, setTab] = useState<"PLANNER" | "POS" | "LEDGER">("PLANNER");

  const [newEventName, setNewEventName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmt, setNewExpAmt] = useState("");
  const [marginMultiplier, setMarginMultiplier] = useState<number>(3);

  const [cart, setCart] = useState<{itemId: string; name: string; quantity: number; unitPrice: number}[]>([]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  
  const [importing, setImporting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

  // IMPORT INVENTORY STATE
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSourceId, setImportSourceId] = useState("");
  const [importingInv, setImportingInv] = useState(false);

  async function handleImportInventory() {
    if (!activeEvent || !importSourceId) return;
    setImportingInv(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IMPORT_INVENTORY", sourceEventId: importSourceId, targetEventId: activeEvent.id })
      });
      const data = await res.json();
      if (res.ok) {
        setShowImportModal(false);
        setImportSourceId("");
        loadEventDetails(activeEvent.id);
      } else {
        alert("Import Error: " + (data.error || "Failed to clone inventory."));
      }
    } catch (err) { alert("Network Error."); }
    setImportingInv(false);
  }

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setEvents(data.events || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadEventDetails(id: string) {
    try {
      const res = await fetch(`/api/events?id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) { setActiveEvent(data.event); setView("DETAIL"); }
    } catch(e) { console.error(e); }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_EVENT", name: newEventName, eventDate: new Date().toISOString() }) });
    if (res.ok) { setNewEventName(""); loadEvents(); }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEvent || activeEvent.status === "POSTED") return;
    const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ADD_ITEM", eventId: activeEvent.id, name: newItemName, quantity: newItemQty, unitCost: newItemCost }) });
    if (res.ok) { setNewItemName(""); setNewItemQty(""); setNewItemCost(""); loadEventDetails(activeEvent.id); }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEvent || activeEvent.status === "POSTED") return;
    const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ADD_EXPENSE", eventId: activeEvent.id, description: newExpDesc, amount: newExpAmt }) });
    if (res.ok) { setNewExpDesc(""); setNewExpAmt(""); loadEventDetails(activeEvent.id); }
  }

  async function handleDelete(id: string, action: string) {
    if (activeEvent?.status === "POSTED" && action !== "DELETE_EVENT") return alert("Cannot delete items from an event that is already posted to the master ERP.");
    await fetch("/api/events", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    if (action === "DELETE_EVENT") { loadEvents(); setView("LIST"); }
    else if (activeEvent) loadEventDetails(activeEvent.id);
  }

  function addToCart(item: EventItem, defaultPrice: number) {
    if (activeEvent?.status === "POSTED") return;
    const exists = cart.find(c => c.itemId === item.id);
    if (exists) { setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)); } 
    else { setCart([...cart, { itemId: item.id, name: item.name, quantity: 1, unitPrice: defaultPrice }]); }
  }

  function updateCartItem(itemId: string, field: string, value: string) {
    setCart(cart.map(c => c.itemId === itemId ? { ...c, [field]: Number(value) } : c));
  }

  async function handleCheckout() {
    if (cart.length === 0 || !activeEvent || activeEvent.status === "POSTED") return;
    try {
      const totalAmount = cart.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
      const res = await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RECORD_SALE", eventId: activeEvent.id, cart, customerName: custName, customerPhone: custPhone, paymentMethod: payMethod, totalAmount })
      });
      const data = await res.json();
      if (res.ok) { setCart([]); setCustName(""); setCustPhone(""); setPayMethod("CASH"); loadEventDetails(activeEvent.id); } 
      else { alert("POS Error: " + (data.error || "Failed to complete sale.")); }
    } catch (err) { alert("Network Error: Could not reach the server."); }
  }

  async function handleImportToERP() {
    if (!activeEvent || activeEvent.status === "POSTED") return;
    setImporting(true);
    try {
      const res = await fetch("/api/events/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: activeEvent.id })
      });
      const data = await res.json();
      if (res.ok) {
        setShowPreview(false);
        alert("Success! Formal Invoice and Journal Entry posted to Master ERP. Awaiting your manual Payment Receipt.");
        loadEventDetails(activeEvent.id);
      } else { alert("Import Error: " + (data.error || "Failed to push to ERP.")); }
    } catch (err) { alert("Network Error."); }
    setImporting(false);
  }

  const safeExpenses = activeEvent?.expenses || [];
  const safeItems = activeEvent?.items || [];
  const safeSales = activeEvent?.sales || [];
  
  const totalOverhead = safeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalItems = safeItems.reduce((sum, i) => sum + Number(i.quantity), 0);
  const overheadPerItem = totalItems > 0 ? totalOverhead / totalItems : 0;
  
  const totalRevenue = safeSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const actualCOGS = safeSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, saleItem) => {
      const origItem = safeItems.find(i => i.id === saleItem.itemId);
      return itemSum + (saleItem.quantity * Number(origItem?.unitCost || 0));
    }, 0);
  }, 0);
  const netProfit = totalRevenue - actualCOGS - totalOverhead;
  const isPosted = activeEvent?.status === "POSTED";

  function handlePrintPriceList() {
    if (!activeEvent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print reports.");
    const dateStr = new Date(activeEvent.eventDate).toLocaleDateString();
    const totalBaseValue = safeItems.reduce((sum, i) => sum + (i.quantity * Number(i.unitCost)), 0);
    const totalRetailValue = safeItems.reduce((sum, i) => {
      const breakeven = Number(i.unitCost) + overheadPerItem;
      const suggested = Math.ceil((breakeven * marginMultiplier) / 10) * 10;
      return sum + (i.quantity * suggested);
    }, 0);
    const rows = safeItems.map(i => {
      const breakeven = Number(i.unitCost) + overheadPerItem;
      const suggested = Math.ceil((breakeven * marginMultiplier) / 10) * 10;
      return `<tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${i.name}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${i.quantity}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">Rs ${Number(i.unitCost).toLocaleString()}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444;">Rs ${breakeven.toFixed(2)}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-size: 16px;">Rs ${suggested}</td></tr>`;
    }).join("");
    const html = `<html><head><title>Price List - ${activeEvent.name}</title><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; } .header { text-align: center; margin-bottom: 30px; } .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; } .header h2 { margin: 5px 0 0 0; font-size: 16px; color: #6b7280; font-weight: normal; } .info-box { margin-bottom: 30px; padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; justify-content: space-between; font-size: 14px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { text-align: left; padding: 12px 10px; background: #111827; color: white; font-size: 13px; text-transform: uppercase; } th:nth-child(2) { text-align: center; } th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; } .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; text-transform: uppercase; letter-spacing: 1px; }</style></head><body><div class="header"><h1>Izan Bling</h1><h2>Event Price List & Initial Inventory</h2></div><div class="info-box"><div><strong>Event:</strong> ${activeEvent.name}<br/><strong>Date:</strong> ${dateStr}<br/><strong>Total Items:</strong> ${totalItems} Units</div><div style="text-align: right;"><strong>Margin Target:</strong> ${marginMultiplier}x<br/><strong>Total Base Capital:</strong> Rs ${totalBaseValue.toLocaleString()}<br/><strong>Total Retail Value:</strong> Rs ${totalRetailValue.toLocaleString()}</div></div><table><thead><tr><th>Item Description</th><th>Qty</th><th>Base Cost</th><th>Breakeven (Cost+OH)</th><th>Sale Price</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Generated by Izan Bling ERP on ${new Date().toLocaleString()}</div><script> window.onload = function() { window.print(); window.close(); } </script></body></html>`;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  }

  function handlePrintRemainingStock() {
    if (!activeEvent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print reports.");
    const dateStr = new Date(activeEvent.eventDate).toLocaleDateString();

    const rows = safeItems.map(i => {
      const soldQty = safeSales.reduce((sum, s) => {
        const match = s.items.find(si => si.itemId === i.id);
        return sum + (match ? match.quantity : 0);
      }, 0);
      const remaining = i.quantity - soldQty;
      const baseValueRemaining = remaining * Number(i.unitCost);

      return `<tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${i.name}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${i.quantity}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #ef4444;">${soldQty}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: #10b981; font-size: 16px;">${remaining}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">Rs ${baseValueRemaining.toLocaleString()}</td></tr>`;
    }).join("");

    const totalSoldGlobal = safeItems.reduce((sum, i) => {
      return sum + safeSales.reduce((sSum, s) => {
        const match = s.items.find(si => si.itemId === i.id);
        return sSum + (match ? match.quantity : 0);
      }, 0);
    }, 0);
    
    const totalRemainingGlobal = totalItems - totalSoldGlobal;
    const totalRemainingValue = safeItems.reduce((sum, i) => {
      const soldQty = safeSales.reduce((sSum, s) => {
        const match = s.items.find(si => si.itemId === i.id);
        return sSum + (match ? match.quantity : 0);
      }, 0);
      return sum + ((i.quantity - soldQty) * Number(i.unitCost));
    }, 0);

    const html = `<html><head><title>Stock Taking Report - ${activeEvent.name}</title><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; } .header { text-align: center; margin-bottom: 30px; } .header h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; } .header h2 { margin: 5px 0 0 0; font-size: 16px; color: #6b7280; font-weight: normal; } .info-box { margin-bottom: 30px; padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; justify-content: space-between; font-size: 14px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { text-align: left; padding: 12px 10px; background: #111827; color: white; font-size: 13px; text-transform: uppercase; } th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; } th:nth-child(5) { text-align: right; } .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; text-transform: uppercase; letter-spacing: 1px; }</style></head><body><div class="header"><h1>Izan Bling</h1><h2>End-of-Day Stock Taking Report</h2></div><div class="info-box"><div><strong>Event:</strong> ${activeEvent.name}<br/><strong>Date:</strong> ${dateStr}</div><div style="text-align: right;"><strong>Total Sold:</strong> ${totalSoldGlobal} Units<br/><strong>Total Remaining:</strong> ${totalRemainingGlobal} Units<br/><strong>Remaining Base Value:</strong> Rs ${totalRemainingValue.toLocaleString()}</div></div><table><thead><tr><th>Item Description</th><th>Initial Qty</th><th>Sold Qty</th><th>Remaining Qty</th><th>Remaining Value (Cost)</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Generated by Izan Bling ERP on ${new Date().toLocaleString()}</div><script> window.onload = function() { window.print(); window.close(); } </script></body></html>`;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  }

  function handlePrintLedger() {
    if (!activeEvent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print reports.");
    const dateStr = new Date(activeEvent.eventDate).toLocaleDateString();
    const rows = safeSales.map(s => {
      const time = new Date(s.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const itemsCount = s.items.reduce((sum, i) => sum + i.quantity, 0);
      return `<tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${time}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>${s.customerName || "Walk-in"}</strong></td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${s.paymentMethod}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${itemsCount}</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #10b981;">Rs ${Number(s.totalAmount).toLocaleString()}</td></tr>`;
    }).join("");
    const html = `<html><head><style>body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; } .header { text-align: center; margin-bottom: 30px; } table { width: 100%; border-collapse: collapse; margin-top: 10px; } th { text-align: left; padding: 12px 10px; background: #111827; color: white; text-transform: uppercase; } th:nth-child(3), th:nth-child(4) { text-align: center; } th:nth-child(5) { text-align: right; } .summary-box { padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; width: 350px; float: right; } .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; } .summary-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; border-top: 2px solid #cbd5e1; }</style></head><body><div class="header"><h1>Event Sales Ledger</h1></div><table><thead><tr><th>Time</th><th>Customer</th><th>Payment</th><th>Items</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div style="clear:both; margin-top:30px;"><div class="summary-box"><div class="summary-row"><span>Revenue:</span><strong>Rs ${totalRevenue.toLocaleString()}</strong></div><div class="summary-row"><span>COGS:</span><strong style="color:red">- Rs ${actualCOGS.toLocaleString()}</strong></div><div class="summary-row"><span>Overhead:</span><strong style="color:red">- Rs ${totalOverhead.toLocaleString()}</strong></div><div class="summary-row"><span>Net Profit:</span><strong style="color:${netProfit >= 0 ? 'green' : 'red'}">Rs ${netProfit.toLocaleString()}</strong></div></div></div><script>window.onload = function() { window.print(); window.close(); }</script></body></html>`;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  }

  if (view === "LIST") {
    return (
      <div style={{ padding: "32px", background: "#f9fafb", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <style dangerouslySetInnerHTML={{ __html: mobileStyles }} />
        <h1 style={{ margin: "0 0 32px 0", fontSize: "28px", fontWeight: 800, color: "#111827" }}>Event Sandbox</h1>
        <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb", marginBottom: "32px" }}>
          <form onSubmit={handleCreateEvent} style={{ display: "flex", gap: "12px" }}>
            <input required value={newEventName} onChange={(e)=>setNewEventName(e.target.value)} placeholder="Event Name (e.g., PNCA Pop-up)" style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
            <button type="submit" style={{ padding: "12px 24px", background: "#111827", color: "white", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}>+ Create Event</button>
          </form>
        </div>
        
        {/* NEW SINGLE-ROW LIST DASHBOARD */}
        <div className="table-container" style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "1px" }}>
          <table className="erp-data-table">
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280", background: "#f8fafc" }}>
                <th >Date</th>
                <th >Event Name</th>
                <th >Revenue</th>
                <th >COGS</th>
                <th >Overhead</th>
                <th >Net Profit</th>
                <th >Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const evExpenses = ev.expenses || [];
                const evItems = ev.items || [];
                const evSales = ev.sales || [];
                
                const cardOverhead = evExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
                const cardRevenue = evSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
                const cardCOGS = evSales.reduce((sum, sale) => {
                  return sum + (sale.items || []).reduce((itemSum, saleItem) => {
                    const origItem = evItems.find(i => i.id === saleItem.itemId);
                    return itemSum + (saleItem.quantity * Number(origItem?.unitCost || 0));
                  }, 0);
                }, 0);
                const cardProfit = cardRevenue - cardCOGS - cardOverhead;

                return (
                  <tr key={ev.id} onClick={() => loadEventDetails(ev.id)} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }} onMouseOver={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                    <td >{new Date(ev.eventDate).toLocaleDateString()}</td>
                    <td >{ev.name}</td>
                    <td >Rs {cardRevenue.toLocaleString()}</td>
                    <td >- Rs {cardCOGS.toLocaleString()}</td>
                    <td >- Rs {cardOverhead.toLocaleString()}</td>
                    <td >
                      {cardProfit > 0 ? "+" : ""}Rs {cardProfit.toLocaleString()}
                    </td>
                    <td >
                      {ev.status === "POSTED" ? (
                        <span style={{ background: "#10b981", color: "white", fontSize: "11px", padding: "4px 8px", borderRadius: "4px", fontWeight: 800 }}>POSTED</span>
                      ) : (
                        <span style={{ background: "#e2e8f0", color: "#64748b", fontSize: "11px", padding: "4px 8px", borderRadius: "4px", fontWeight: 800 }}>DRAFT</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {events.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>No events found. Create your first pop-up above!</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", background: "#f9fafb", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: mobileStyles }} />
      <button onClick={() => setView("LIST")} style={{ marginBottom: "20px", background: "none", border: "none", color: "#4f46e5", fontWeight: 700, cursor: "pointer" }}>← Back</button>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#111827" }}>{activeEvent?.name}</h1>
          {isPosted && <span style={{ background: "#10b981", color: "white", fontSize: "12px", padding: "4px 10px", borderRadius: "4px", fontWeight: 800 }}>LOCKED</span>}
        </div>
        <button onClick={() => handleDelete(activeEvent!.id, "DELETE_EVENT")} style={{ padding: "10px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}>Delete Event</button>
      </div>

      <div className="tab-menu" style={{ display: "flex", gap: "24px", marginBottom: "24px", borderBottom: "2px solid #e5e7eb" }}>
        <button onClick={()=>setTab("PLANNER")} style={{ padding: "12px 0", background: "none", border: "none", borderBottom: tab === "PLANNER" ? "3px solid #111827" : "3px solid transparent", fontWeight: 700, cursor: "pointer", color: tab === "PLANNER" ? "#111827" : "#6b7280" }}>📊 PLANNER & COSTS</button>
        <button onClick={()=>setTab("POS")} style={{ padding: "12px 0", background: "none", border: "none", borderBottom: tab === "POS" ? "3px solid #3b82f6" : "3px solid transparent", fontWeight: 700, cursor: "pointer", color: tab === "POS" ? "#3b82f6" : "#6b7280" }}>🛍️ LIVE POS</button>
        <button onClick={()=>setTab("LEDGER")} style={{ padding: "12px 0", background: "none", border: "none", borderBottom: tab === "LEDGER" ? "3px solid #10b981" : "3px solid transparent", fontWeight: 700, cursor: "pointer", color: tab === "LEDGER" ? "#10b981" : "#6b7280" }}>🧾 SALES LEDGER</button>
      </div>

      {tab === "PLANNER" && (
        <div className="layout-grid">
          <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <h3>Event Overhead (Rs {totalOverhead.toLocaleString()})</h3>
            {!isPosted && (
              <form onSubmit={handleAddExpense} style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <input required value={newExpDesc} onChange={(e)=>setNewExpDesc(e.target.value)} placeholder="Desc" style={{ flex: 2, padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <input required type="number" value={newExpAmt} onChange={(e)=>setNewExpAmt(e.target.value)} placeholder="Rs" style={{ flex: 1, padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <button type="submit" style={{ padding: "8px 12px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}>Add</button>
              </form>
            )}
            {safeExpenses.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                <span>{e.description}</span>
                <div><strong>Rs {Number(e.amount).toLocaleString()}</strong> {!isPosted && <button onClick={() => handleDelete(e.id, "DELETE_EXPENSE")} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>x</button>}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <h3 style={{ margin: 0 }}>Suitcase Inventory</h3>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {!isPosted && (
                  <button onClick={() => setShowImportModal(true)} style={{ padding: "8px 12px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "12px", marginRight: "8px" }}>
                    📦 Import Past Inventory
                  </button>
                )}
                <div style={{ fontSize: "13px", fontWeight: 700, marginRight: "4px" }}>
                  Margin: <input type="number" step="0.1" value={marginMultiplier} onChange={(e) => setMarginMultiplier(Number(e.target.value))} disabled={isPosted} style={{ width: "50px", padding: "4px", borderRadius: "4px", border: "1px solid #d1d5db", textAlign: "center", background: isPosted ? "#f1f5f9" : "white" }} />x
                </div>
                <button onClick={handlePrintPriceList} style={{ padding: "8px 12px", background: "#111827", color: "white", border: "none", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                  🖨️ Price List
                </button>
                <button onClick={handlePrintRemainingStock} style={{ padding: "8px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                  📦 Stock Taking
                </button>
              </div>
            </div>

            {!isPosted && (
              <form onSubmit={handleAddItem} style={{ display: "flex", gap: "10px", margin: "20px 0", padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                <input required value={newItemName} onChange={(e)=>setNewItemName(e.target.value)} placeholder="Item" style={{ flex: 2, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <input required type="number" value={newItemQty} onChange={(e)=>setNewItemQty(e.target.value)} placeholder="Qty" style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <input required type="number" value={newItemCost} onChange={(e)=>setNewItemCost(e.target.value)} placeholder="Cost (Rs)" style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <button type="submit" style={{ padding: "10px 16px", background: "#111827", color: "white", border: "none", borderRadius: "6px", fontWeight: 700 }}>Add</button>
              </form>
            )}

            <div className="table-container" style={{ marginTop: "20px" }}>
              <table className="erp-data-table">
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280" }}>
                    <th >Item</th>
                    <th>Initial Qty</th>
                    <th>Sold</th>
                    <th style={{ color: "#3b82f6" }}>Remaining</th>
                    <th style={{ color: "#ef4444" }}>Base Cost</th>
                    <th style={{ color: "#ef4444" }}>Breakeven</th>
                    <th style={{ color: "#10b981" }}>Suggested Tag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {safeItems.map(i => {
                    const breakeven = Number(i.unitCost) + overheadPerItem;
                    const suggested = Math.ceil((breakeven * marginMultiplier) / 10) * 10;
                    
                    const soldQty = safeSales.reduce((sum, s) => {
                      const match = s.items.find(si => si.itemId === i.id);
                      return sum + (match ? match.quantity : 0);
                    }, 0);
                    const remainingQty = i.quantity - soldQty;

                    return (
                      <tr key={i.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td >{i.name}</td>
                        <td>{i.quantity}</td>
                        <td>{soldQty}</td>
                        <td style={{ fontWeight: 800, color: remainingQty < 0 ? "#ef4444" : "#3b82f6" }}>{remainingQty}</td>
                        <td style={{ color: "#ef4444" }}>Rs {Number(i.unitCost).toLocaleString()}</td>
                        <td style={{ color: "#ef4444" }}>Rs {breakeven.toFixed(2)}</td>
                        <td style={{ color: "#10b981", fontWeight: 800 }}>Rs {suggested}</td>
                        <td>{!isPosted && <button onClick={() => handleDelete(i.id, "DELETE_ITEM")} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>x</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT INVENTORY MODAL */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(17,24,39,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", padding: "32px", borderRadius: "16px", width: "450px", maxWidth: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ marginTop: 0, fontSize: "20px", color: "#111827", fontWeight: 800 }}>Clone Inventory</h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Select a past event below. Its entire item list, quantities, and base costs will be instantly copied into <b>{activeEvent?.name}</b>.</p>
            
            <select value={importSourceId} onChange={e => setImportSourceId(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", marginBottom: "24px", background: "#f8fafc", fontWeight: 600, outline: "none" }}>
              <option value="">-- Select an Event to Clone --</option>
              {events.filter(e => e.id !== activeEvent?.id).map(e => (
                <option key={e.id} value={e.id}>{new Date(e.eventDate).toLocaleDateString()} — {e.name}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowImportModal(false)} style={{ padding: "10px 20px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleImportInventory} disabled={!importSourceId || importingInv} style={{ padding: "10px 20px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "8px", fontWeight: 800, cursor: (!importSourceId || importingInv) ? "not-allowed" : "pointer" }}>
                {importingInv ? "Cloning..." : "Import Items"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "POS" && (
        <div className="pos-grid">
          <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb", opacity: isPosted ? 0.6 : 1, pointerEvents: isPosted ? "none" : "auto" }}>
            <h3 style={{ marginTop: 0 }}>Tap to add to cart</h3>
            {isPosted && <p style={{ color: "#ef4444", fontWeight: 700 }}>This event is locked. No new sales can be recorded.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
              {safeItems.map(item => {
                const soldQty = safeSales.reduce((sum, s) => { const match = s.items.find(si => si.itemId === item.id); return sum + (match ? match.quantity : 0); }, 0);
                const remaining = item.quantity - soldQty;
                return (
                  <div key={item.id} onClick={() => remaining > 0 && addToCart(item, Number(item.unitCost))} style={{ background: remaining > 0 ? "#f8fafc" : "#fef2f2", border: "1px solid #e2e8f0", padding: "16px", borderRadius: "12px", cursor: remaining > 0 ? "pointer" : "not-allowed", opacity: remaining > 0 ? 1 : 0.6 }}>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "#1e293b", marginBottom: "8px" }}>{item.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>{remaining} left in stock</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "2px solid #3b82f6", display: "flex", flexDirection: "column", opacity: isPosted ? 0.6 : 1 }}>
            <h3 style={{ marginTop: 0 }}>Current Checkout</h3>
            <div style={{ flex: 1, minHeight: "200px" }}>
              {cart.length === 0 ? <p style={{ color: "#9ca3af", textAlign: "center", marginTop: "40px" }}>Cart is empty</p> : (
                cart.map(c => (
                  <div key={c.itemId} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", background: "#f8fafc", padding: "8px", borderRadius: "8px" }}>
                    <div style={{ flex: 2, fontWeight: 700, fontSize: "13px" }}>{c.name}</div>
                    <input type="number" value={c.quantity} onChange={(e) => updateCartItem(c.itemId, 'quantity', e.target.value)} style={{ width: "50px", padding: "4px", border: "1px solid #cbd5e1", borderRadius: "4px", textAlign: "center" }} />
                    <span style={{ fontSize: "12px" }}>x</span>
                    <input type="number" value={c.unitPrice} onChange={(e) => updateCartItem(c.itemId, 'unitPrice', e.target.value)} style={{ width: "80px", padding: "4px", border: "1px solid #cbd5e1", borderRadius: "4px" }} />
                    <button onClick={() => setCart(cart.filter(x => x.itemId !== c.itemId))} style={{ color: "red", border: "none", background: "none", cursor: "pointer", fontWeight: 800 }}>X</button>
                  </div>
                ))
              )}
            </div>
            <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "16px", marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "24px", fontWeight: 800, marginBottom: "24px" }}>
                <span>Total:</span><span style={{ color: "#3b82f6" }}>Rs {cart.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0).toLocaleString()}</span>
              </div>
              <button onClick={handleCheckout} disabled={cart.length === 0 || isPosted} style={{ width: "100%", padding: "16px", background: (cart.length > 0 && !isPosted) ? "#3b82f6" : "#9ca3af", color: "white", fontWeight: 800, fontSize: "16px", border: "none", borderRadius: "8px", cursor: (cart.length > 0 && !isPosted) ? "pointer" : "not-allowed" }}>
                COMPLETE SALE
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "LEDGER" && (
        <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showPreview ? "24px" : "0" }}>
            <h3 style={{ margin: 0 }}>Event Sales Ledger</h3>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <button onClick={handlePrintLedger} style={{ padding: "8px 12px", background: "#f1f5f9", color: "#111827", border: "1px solid #cbd5e1", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>🖨️ Print Final Report</button>
              
              <button onClick={() => setShowPreview(true)} disabled={isPosted || safeSales.length === 0} style={{ padding: "8px 16px", background: isPosted ? "#10b981" : "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: 700, cursor: (isPosted || safeSales.length === 0) ? "not-allowed" : "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                {isPosted ? "✓ Posted to Master ERP" : "🔍 Preview ERP Sync"}
              </button>
            </div>
          </div>

                    {showPreview && !isPosted && (
            <div style={{ background: "#f8fafc", border: "2px solid #cbd5e1", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "18px" }}>📊 Pre-Flight Journal Preview</h3>
              <p style={{ fontSize: "14px", color: "#475569", marginBottom: "20px" }}>
                This will generate a formal <b>Sales Invoice</b> and post the following balanced <b>Journal Entry</b> to your General Ledger. <br/>
                <i style={{color: "#dc2626"}}>* The invoice will remain UNPAID. You must manually record the payment in the ERP against this invoice based on actual funds received.</i>
              </p>

              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
                <table className="erp-data-table">
                  <thead style={{ background: "#1e293b", color: "white" }}>
                    <tr>
                      <th >Account Type</th>
                      <th >Description</th>
                      <th >Debit (Dr)</th>
                      <th >Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td >Accounts Receivable (Asset)</td>
                      <td >Invoice Total Generated</td>
                      <td >Rs {totalRevenue.toLocaleString()}</td>
                      <td >—</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td >Sales Revenue (Revenue)</td>
                      <td >Event Revenue</td>
                      <td >—</td>
                      <td >Rs {totalRevenue.toLocaleString()}</td>
                    </tr>
                    {actualCOGS > 0 && (
                      <>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td >Cost of Goods Sold (Expense)</td>
                          <td >Base Cost of Items Sold</td>
                          <td >Rs {actualCOGS.toLocaleString()}</td>
                          <td >—</td>
                        </tr>
                        <tr>
                          <td >Inventory (Asset)</td>
                          <td >Stock Reduction</td>
                          <td >—</td>
                          <td >Rs {actualCOGS.toLocaleString()}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowPreview(false)} style={{ padding: "10px 20px", background: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleImportToERP} disabled={importing} style={{ padding: "10px 24px", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", fontWeight: 800, cursor: importing ? "not-allowed" : "pointer" }}>
                  {importing ? "Posting..." : "📝 Generate Invoice & Journal Entry"}
                </button>
              </div>
            </div>
          )}
          
          <div className="table-container">
            <table className="erp-data-table">
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280" }}>
                  <th >Time</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Items Sold</th>
                  <th style={{ color: "#10b981" }}>Total Amount</th>
                  <th >Actions</th>
                </tr>
              </thead>
              <tbody>
                {safeSales.map(s => (
                  <React.Fragment key={s.id}>
                    <tr style={{ borderBottom: viewSaleId === s.id ? "none" : "1px solid #f1f5f9", background: viewSaleId === s.id ? "#f8fafc" : "transparent" }}>
                      <td >{new Date(s.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style={{ fontWeight: 700 }}>{s.customerName || "Walk-in"} <br/><span style={{fontSize:"11px", color:"#94a3b8", fontWeight: 400}}>{s.customerPhone}</span></td>
                      <td><span style={{ background: "#e2e8f0", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 800 }}>{s.paymentMethod}</span></td>
                      <td>{s.items.reduce((sum, i) => sum + i.quantity, 0)} items</td>
                      <td style={{ color: "#10b981", fontWeight: 800 }}>Rs {Number(s.totalAmount).toLocaleString()}</td>
                      <td >
                        <button onClick={() => setViewSaleId(viewSaleId === s.id ? null : s.id)} style={{ color: "#3b82f6", border: "none", background: "none", cursor: "pointer", marginRight: isPosted ? "0" : "16px", fontWeight: 700 }}>
                          {viewSaleId === s.id ? "Hide" : "View"}
                        </button>
                        {!isPosted && <button onClick={() => handleDelete(s.id, "DELETE_SALE")} style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}>Delete</button>}
                      </td>
                    </tr>
                    {viewSaleId === s.id && (
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <td colSpan={6} >
                          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                            <div style={{ fontWeight: 800, marginBottom: "12px", color: "#1e293b", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>Invoice Details</div>
                            <table className="erp-data-table">
                              <thead>
                                <tr style={{ color: "#64748b", borderBottom: "1px solid #cbd5e1" }}>
                                  <th >Item Description</th>
                                  <th >Qty</th>
                                  <th >Selling Price</th>
                                  <th >Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.items.map(si => {
                                  const origItem = safeItems.find(i => i.id === si.itemId);
                                  return (
                                    <tr key={si.id} style={{ borderBottom: "1px dashed #e2e8f0" }}>
                                      <td >{origItem?.name || "Unknown Item"}</td>
                                      <td >{si.quantity}</td>
                                      <td >Rs {Number(si.unitPrice).toLocaleString()}</td>
                                      <td >Rs {Number(si.totalPrice).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div style={{ textAlign: "right", marginTop: "16px", fontSize: "15px", fontWeight: 800 }}>Invoice Total: <span style={{ color: "#3b82f6", marginLeft: "8px" }}>Rs {Number(s.totalAmount).toLocaleString()}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "350px", background: "#f8fafc", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px" }}>
                <span>Total Revenue:</span> <strong>Rs {totalRevenue.toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", color: "#ef4444" }}>
                <span>Total COGS:</span> <strong>- Rs {actualCOGS.toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", color: "#ef4444" }}>
                <span>Total Overhead:</span> <strong>- Rs {totalOverhead.toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", borderTop: "2px solid #cbd5e1", fontSize: "18px", fontWeight: 800 }}>
                <span>Net Profit:</span> <span style={{ color: netProfit >= 0 ? "#10b981" : "#ef4444" }}>Rs {netProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}