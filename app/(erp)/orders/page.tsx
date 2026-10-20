"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, PackageOpen, Truck, CheckCircle2, Printer, Trash2, Edit, Eye, PlusCircle } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function OrderPipelinePage() {
  const { config: salesConfig } = useERPConfig("sales");
  const { formatAmount, currency } = useERPConfig("general");
  
  const [view, setView] = useState<"list" | "create" | "manage">("list");
  const [activeTab, setActiveTab] = useState("SALE_ORDER");
  
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dbCouriers, setDbCouriers] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  
  const [editLines, setEditLines] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  
  // Dispatch States
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [courierName, setCourierName] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number | string>(0);
  const [paymentStatus, setPaymentStatus] = useState(salesConfig?.defaultPaymentStatus || "PENDING");

  const tabs = [
    { id: "SALE_ORDER", label: "Pending Orders" },
    { id: "CONFIRMATION", label: "Confirmed" },
    { id: "DISPATCHED", label: "Dispatched" }
  ];

  const fetchPipelineData = async () => {
    setLoading(true);
    try {
      const [orderRes, courierRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/couriers")
      ]);
      
      const orderData = await orderRes.json();
      const courierData = await courierRes.json();

      if (orderData.success) {
        setOrders(orderData.orders);
        setCustomers(orderData.customers);
        setCompany(orderData.company);
        setProducts(orderData.products.map((p: any) => ({ ...p, price: Number(p.salePrice || p.salesPrice || p.costPrice || 0) })));
      }
      if (courierData.success) {
        setDbCouriers(courierData.couriers.filter((c: any) => c.isActive));
      }
    } catch (e) { console.error("Failed to fetch pipeline"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPipelineData(); }, []);

  const filteredOrders = useMemo(() => orders.filter(o => o.status === activeTab), [orders, activeTab]);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCreateOrder = async () => {
    if (!selectedCustomer || cart.length === 0) return alert("Select a customer and add items.");
    setProcessing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer, cart, totalAmount: subtotal })
      });
      const data = await res.json();
      if (data.success) {
        await fetchPipelineData(); setView("list"); setCart([]); setSelectedCustomer("");
      } else alert("Failed to create order: " + (data.error || "Check backend console"));
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and delete this order?")) return;
    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
      if (res.ok) setOrders(orders.filter(o => o.id !== id));
    } catch (e) { alert("Network error."); }
  };

  const handleBulkGenerate = async () => {
    if (selectedOrders.length === 0 || !confirm(`Auto-allocate and generate ${selectedOrders.length} orders?`)) return;
    setProcessing(true);
    for (const id of selectedOrders) {
      const order = orders.find(o => o.id === id);
      if (!order) continue;
      const autoAllocations: Record<string, string> = {};
      order.lines.forEach((line: any) => { autoAllocations[line.id] = "AUTO"; });
      try {
        await fetch("/api/orders/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, allocations: autoAllocations, courierName: "", bookingRef: "", deliveryFee: 0, paymentStatus: "PENDING" })
        });
      } catch (e) {}
    }
    alert("Bulk generation complete.");
    setSelectedOrders([]);
    await fetchPipelineData();
    setProcessing(false);
  };

  const handleSaveEdits = async () => {
    setProcessing(true);
    const newTotal = editLines.reduce((sum, l) => sum + Number(l.subtotal), 0);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_LINES", id: activeOrder.id, totalAmount: newTotal, lines: editLines })
      });
      if (res.ok) { alert("Order items updated successfully!"); await fetchPipelineData(); setView("list"); }
    } catch(e) { alert("Error saving edits"); } finally { setProcessing(false); }
  };

  const handleUpdateOrder = async (targetStatus: string) => {
    if (targetStatus === "DISPATCHED" && !bookingRef) return alert("Please enter tracking reference.");
    setProcessing(true);
    const combinedTracking = `${courierName} | ${bookingRef}`;
    try {
      const res = await fetch("/api/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "DISPATCH", id: activeOrder.id, status: targetStatus, bookingNumber: combinedTracking,
          courierName, courierId: selectedCourierId, trackingNumber: bookingRef, deliveryCharges: Number(deliveryFee) || 0, paymentStatus
        })
      });
      const data = await res.json();
      if (data.success) { await fetchPipelineData(); setView("list"); setActiveOrder(null); } 
      else alert("Update failed");
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const handleGenerateOrder = async () => {
    setProcessing(true);
    const combinedTracking = bookingRef ? `${courierName} | ${bookingRef}` : "";
    try {
      const res = await fetch("/api/orders/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeOrder.id, allocations, courierName, courierId: selectedCourierId, bookingRef: combinedTracking, deliveryFee: Number(deliveryFee) || 0, paymentStatus })
      });
      const data = await res.json();
      if (data.success) { alert("Order generated and draft invoice created!"); await fetchPipelineData(); setView("list"); setActiveOrder(null); } 
      else alert("Generation failed: " + data.error);
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const openManage = (order: any) => {
    setActiveOrder(order);
    setEditLines(order.lines.map((l: any) => ({ id: l.id, productId: l.productId, name: l.product?.name, quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.subtotal })));
    const initialAllocations: Record<string, string> = {};
    order.lines.forEach((line: any) => { initialAllocations[line.id] = "AUTO"; });
    setAllocations(initialAllocations);
    
    const trackingStr = order.bookingNumber || "";
    const cName = trackingStr.includes(" | ") ? trackingStr.split(" | ")[0] : (salesConfig?.defaultCourier || "TCS");
    const matchedCourier = dbCouriers.find(c => c.name.toLowerCase() === cName.toLowerCase());
    
    if (matchedCourier) {
      setSelectedCourierId(matchedCourier.id);
      setCourierName(matchedCourier.name);
    } else if (dbCouriers.length > 0) {
      setSelectedCourierId(dbCouriers[0].id);
      setCourierName(dbCouriers[0].name);
    }
    
    setBookingRef(trackingStr.includes(" | ") ? trackingStr.split(" | ")[1] : trackingStr);
    setDeliveryFee(Number(order.deliveryCharges) || 0);
    setPaymentStatus(order.paymentStatus || salesConfig?.defaultPaymentStatus || "PENDING");
    setView("manage");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold tracking-widest uppercase animate-pulse">Loading Pipeline & Logistics...</div>;

  return (
    <>
      <div className="space-y-6 relative z-10 w-full pb-10 print:pb-0 print:space-y-0">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Pipeline</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Manage e-commerce fulfillment and logistics</p>
          </div>
          {view === "list" && (
            <button onClick={() => setView("create")} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all">
              <Plus className="w-4 h-4" /> Create Order
            </button>
          )}
          {view !== "list" && (
            <button onClick={() => setView("list")} className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 px-5 py-2.5 rounded-xl font-bold transition-all">
              Back to Pipeline
            </button>
          )}
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="space-y-6 print:hidden">
            <div className="flex gap-2 overflow-x-auto custom-scrollbar border-b border-slate-200 dark:border-white/10 pb-px">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedOrders([]); }} className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id ? "border-teal-500 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 rounded-t-xl" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 p-16 flex flex-col items-center justify-center text-slate-500 dark:text-zinc-500 shadow-sm">
                <PackageOpen className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium text-lg">No orders currently in this stage.</p>
              </div>
            ) : (
              <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-sm">
                {activeTab === "SALE_ORDER" && selectedOrders.length > 0 && (
                  <div className="bg-teal-50/50 dark:bg-teal-900/20 p-4 flex justify-between items-center border-b border-slate-200/80 dark:border-white/5">
                    <span className="text-sm font-bold text-teal-700 dark:text-teal-400">{selectedOrders.length} orders selected</span>
                    <button onClick={handleBulkGenerate} disabled={processing} className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                      {processing ? "Generating..." : "Confirm All (Auto-Allocate)"}
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-slate-50/50 dark:bg-zinc-950/30 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5"><tr>
                    {activeTab === "SALE_ORDER" && (<th className="p-4 w-12 text-center"><input type="checkbox" className="accent-teal-500 w-4 h-4 rounded cursor-pointer" checked={selectedOrders.length === filteredOrders.length} onChange={(e) => e.target.checked ? setSelectedOrders(filteredOrders.map(o => o.id)) : setSelectedOrders([])} /></th>)}
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-center">Items</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        {activeTab === "SALE_ORDER" && (<td className="p-4 text-center"><input type="checkbox" className="accent-teal-500 w-4 h-4 rounded cursor-pointer" checked={selectedOrders.includes(order.id)} onChange={(e) => { if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]); else setSelectedOrders(selectedOrders.filter(id => id !== order.id)); }} /></td>)}
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{order.orderNumber}</td>
                        <td className="p-4 text-slate-700 dark:text-zinc-300">{order.customer?.name}</td>
                        <td className="p-4 text-center font-medium text-slate-500 dark:text-zinc-400">{order.lines.length}</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{currency} {formatAmount(Number(order.totalAmount))}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewingOrder(order)} className="text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"><Eye className="w-3.5 h-3.5" /> View</button>
                            <button onClick={() => openManage(order)} className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"><Edit className="w-3.5 h-3.5" /> Action</button>
                            {activeTab === "SALE_ORDER" && (<button onClick={() => handleDeleteOrder(order.id)} className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors"><Trash2 className="w-3.5 h-3.5" /> Cancel</button>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW */}
        {view === "create" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Select Products</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {products.map(p => (
                  <div key={p.id} className="bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-teal-500/50 cursor-pointer shadow-sm" onClick={() => setCart(prev => prev.find(i => i.id === p.id) ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }])}>
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.name}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-2">{currency} {formatAmount(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 flex flex-col h-[70vh] shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Order Details</h2>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm focus:border-teal-500 outline-none mb-6 appearance-none cursor-pointer">
                <option value="" className="text-slate-500">Select a customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex-1 overflow-y-auto border-t border-slate-200 dark:border-white/10 pt-4 space-y-3 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="overflow-hidden pr-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 font-medium">Qty: {item.qty} x {formatAmount(item.price)}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatAmount(item.qty * item.price)}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Draft Total</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{currency} {formatAmount(subtotal)}</span>
                </div>
                <button onClick={handleCreateOrder} disabled={processing} className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md shadow-teal-500/20">{processing ? "Saving..." : "Save Draft Order"}</button>
              </div>
            </div>
          </div>
        )}

        {/* MANAGE VIEW (EDIT / ALLOCATE) */}
        {view === "manage" && activeOrder && (
          <div className="max-w-5xl mx-auto bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm print:hidden">
            <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-6 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{activeOrder.orderNumber}</h2>
                <p className="text-slate-500 dark:text-zinc-400 mt-1 font-medium">Customer: <span className="text-slate-900 dark:text-white font-bold">{activeOrder.customer?.name}</span></p>
              </div>
              <span className="bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-teal-200 dark:border-teal-500/20">{activeOrder.status.replace("_", " ")}</span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                  {activeOrder.status === "SALE_ORDER" ? "Mini Invoice Editor & Batch Allocation" : "Order Items"}
                </h3>
                
                {activeOrder.status === "SALE_ORDER" ? (
                  <div className="bg-slate-50/50 dark:bg-zinc-950/30 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <table className="w-full text-left text-sm"><thead className="text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-white/10"><tr><th className="pb-2">Product / Batch</th><th className="pb-2 text-center">Req</th><th className="pb-2 text-right">Price</th><th className="pb-2"></th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {editLines.map((line, idx) => {
                        const originalLine = activeOrder.lines.find((l:any) => l.id === line.id) || { product: { stockBatches: [] } };
                        const batches = originalLine.product?.stockBatches || [];
                        const isShort = Number(line.quantity) > batches.reduce((sum: number, b: any) => sum + Number(b.quantity), 0);
                        return (
                          <tr key={idx}>
                            <td className="py-3 pr-2">
                              <p className="font-bold text-slate-900 dark:text-white text-xs mb-1.5">{line.name}</p>
                              <select value={allocations[line.id] || "AUTO"} onChange={e => setAllocations({...allocations, [line.id]: e.target.value})} className={`w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border p-1.5 text-[10px] font-medium rounded outline-none cursor-pointer ${isShort ? 'border-rose-300' : 'border-slate-200 dark:border-white/10'}`}>
                                <option value="AUTO">Auto (FIFO)</option>
                                {batches.map((sb: any) => <option key={sb.id} value={sb.batch?.id}>{sb.batch?.batchNumber} (Avail: {sb.quantity})</option>)}
                              </select>
                            </td>
                            <td className="py-3 text-center">
                              <input type="number" min="1" value={line.quantity} onChange={(e) => {
                                const newQty = Number(e.target.value); const updated = [...editLines];
                                updated[idx].quantity = newQty; updated[idx].subtotal = newQty * Number(line.unitPrice); setEditLines(updated);
                              }} className="w-14 bg-white dark:bg-zinc-900 text-center font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded p-1 outline-none"/>
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">{formatAmount(line.subtotal)}</td>
                            <td className="py-3 text-right"><button onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-md"><Trash2 className="w-3.5 h-3.5"/></button></td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                    <div className="mt-6 flex justify-end"><button onClick={handleSaveEdits} disabled={processing} className="text-xs bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider">{processing ? "Saving..." : "Save Line Changes"}</button></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOrder.lines.map((line: any) => (
                      <div key={line.id} className="flex justify-between items-center bg-slate-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                        <div><p className="text-sm font-bold text-slate-900 dark:text-white">{line.product?.name}</p><p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Qty: {line.quantity} x {formatAmount(Number(line.unitPrice))}</p></div>
                        <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{currency} {formatAmount(Number(line.subtotal))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-6 rounded-2xl border border-slate-200 dark:border-white/10 h-fit shadow-sm">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-2"><Truck className="w-4 h-4" /> Processing Actions</h3>
                
                {activeOrder.status === "SALE_ORDER" && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium leading-relaxed bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-white/10">Confirming this order will permanently deduct the selected batches and post a formal Draft Sales Invoice.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Delivery Charge (To Customer)</label>
                        <input type="number" placeholder="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Payment Mode</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                          <option value="PENDING">COD (Pending)</option>
                          <option value="PAID">NON-COD (Pre-paid)</option>
                        </select>
                      </div>
                    </div>

                    <button onClick={handleGenerateOrder} disabled={processing} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-md shadow-teal-500/20">{processing ? "Generating..." : "Generate & Deduct Stock"}</button>
                  </div>
                )}

                {activeOrder.status === "CONFIRMATION" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Courier Database</label>
                        <select 
                          value={selectedCourierId} 
                          onChange={e => {
                            const id = e.target.value;
                            setSelectedCourierId(id);
                            const matched = dbCouriers.find(x => x.id === id);
                            if (matched) setCourierName(matched.name);
                          }} 
                          className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors cursor-pointer"
                        >
                          <option value="" disabled>Select Courier...</option>
                          {dbCouriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Tracking *</label>
                        <input type="text" placeholder="e.g. 772837332" value={bookingRef} onChange={e => setBookingRef(e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Finalize Delivery Fee (Courier)</label>
                        <input type="number" placeholder="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Payment Mode</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                          <option value="PENDING">COD (Pending)</option>
                          <option value="PAID">NON-COD (Pre-paid)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                      <button onClick={() => window.print()} className="flex-1 bg-white dark:bg-zinc-900 hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Slip</button>
                      <button onClick={() => handleUpdateOrder("DISPATCHED")} disabled={processing} className="flex-[2] bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-md shadow-teal-500/20">Dispatch & Link Ledger</button>
                    </div>
                  </div>
                )}

                {activeOrder.status === "DISPATCHED" && (
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1 tracking-wider">Tracking Reference</p>
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-teal-600 dark:text-teal-400">{bookingRef || "N/A"}</p>
                        <p className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded">{courierName}</p>
                      </div>
                    </div>
                    <button onClick={() => window.print()} className="w-full bg-white dark:bg-zinc-900 hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Print Booking Slip</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODAL (Restored) */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/10 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-950/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Order {viewingOrder.orderNumber}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-2xl transition-colors">&times;</button>
            </div>
            <div className="p-6 text-slate-700 dark:text-zinc-300 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Customer Details</p>
                <p className="font-bold text-slate-900 dark:text-white">{viewingOrder.customer?.name}</p>
                <p className="text-sm font-medium mt-1">{viewingOrder.customer?.phone || "No phone provided"}</p>
                <p className="text-sm font-medium mt-1">{viewingOrder.customer?.address || "No address provided"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Order Items</p>
                <div className="bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-inner">
                  {viewingOrder.lines.map((l:any) => (
                    <div key={l.id} className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium">{l.quantity}x {l.product?.name}</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatAmount(Number(l.subtotal))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-white/10">
                <span className="font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-xs">Total Amount</span>
                <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">{currency} {formatAmount(Number(viewingOrder.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL PRINTER RECEIPT (Restored) */}
      {activeOrder && (
        <div className="print-only font-mono text-[12px] leading-tight text-black bg-white w-full mx-auto p-1 uppercase">
          <div className="text-center font-bold">================================</div>
          <div className="text-center font-bold text-[14px]">
            {activeOrder.status === "CONFIRMATION" ? "COURIER BOOKING SLIP" : "CUSTOMER PACKING SLIP"}
          </div>
          <div className="text-center font-bold mb-2">================================</div>
          
          <div>Date: {new Date().toLocaleDateString()}</div>
          <div>Ord#: {activeOrder.orderNumber}</div>
          {bookingRef && <div>Trk#: {bookingRef}</div>}
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="font-bold">[ SHIPPER INFORMATION ]</div>
          <div>Name: {company?.name || "Izan Bling"}</div>
          <div>Phone: {company?.phone || "+92 300 1234567"}</div>
          <div>Addr: {company?.address || "Headquarters"}</div>
          <div>{company?.city || "Rawalpindi"}</div>
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="font-bold">[ SHIPPED TO (CONSIGNEE) ]</div>
          <div>Name: {activeOrder.customer?.name}</div>
          <div>Phone: {activeOrder.customer?.phone || "________________"}</div>
          <div>Addr: {activeOrder.customer?.address || "________________"}</div>
          <div>{activeOrder.customer?.city || "________________"}</div>
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="font-bold">[ PARCEL DETAILS ]</div>
          <div>Pcs: {activeOrder.lines.reduce((acc: number, l: any) => acc + l.quantity, 0)}</div>
          <div className="whitespace-pre-wrap break-words">
            Desc: {activeOrder.lines.map((l: any) => l.product?.name).join(', ').substring(0, 50)}
            {activeOrder.lines.length > 1 ? '...' : ''}
          </div>
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="font-bold">[ PAYMENT DETAILS ]</div>
          <div className="flex gap-4">
            <span>Status:</span>
            <span>[{paymentStatus === "PENDING" ? "X" : " "}] COD</span>
            <span>[{paymentStatus !== "PENDING" ? "X" : " "}] NON-COD</span>
          </div>
          <div className="mt-1">
            Collect Amt: {paymentStatus === "PENDING" ? `${currency} ${formatAmount(Number(activeOrder.totalAmount) + Number(deliveryFee))}` : `${currency} 0`}
          </div>
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="mt-4">Shipper Sign: ________________</div>
          <div className="mt-6 mb-2">Courier Sign: ________________</div>
          <div className="text-center font-bold">================================</div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.6); }
        .print-only { display: none; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only {
            display: block !important; position: absolute; left: 0; top: 0; width: 80mm; padding: 2mm;
          }
        }
      `}} />
    </>
  );
}