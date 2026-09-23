"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, PackageOpen, Truck, CheckCircle2, Printer, Trash2, Edit, Eye, PlusCircle } from "lucide-react";

export default function OrderPipelinePage() {
  const [view, setView] = useState<"list" | "create" | "manage">("list");
  const [activeTab, setActiveTab] = useState("SALE_ORDER");
  
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
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
  
  const [courierName, setCourierName] = useState("TCS");
  const [bookingRef, setBookingRef] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number | string>(0);
  const [paymentStatus, setPaymentStatus] = useState("PENDING");

  const tabs = [
    { id: "SALE_ORDER", label: "Pending Orders" },
    { id: "CONFIRMATION", label: "Confirmed" },
    { id: "DISPATCHED", label: "Dispatched" }
  ];

  const fetchPipelineData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setCustomers(data.customers);
        setCompany(data.company);
        setProducts(data.products.map((p: any) => ({
          ...p, price: Number(p.salePrice || p.salesPrice || p.costPrice || 0)
        })));
      }
    } catch (e) { console.error("Failed to fetch pipeline"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPipelineData(); }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.status === activeTab);
  }, [orders, activeTab]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCreateOrder = async () => {
    if (!selectedCustomer || cart.length === 0) return alert("Select a customer and add items.");
    setProcessing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer, cart, totalAmount: subtotal })
      });
      const data = await res.json();
      if (data.success) {
        await fetchPipelineData();
        setView("list");
        setCart([]);
        setSelectedCustomer("");
      } else alert("Failed to create order");
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and delete this order?")) return;
    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
      if (res.ok) setOrders(orders.filter(o => o.id !== id));
      else alert("Failed to delete order.");
    } catch (e) { alert("Network error."); }
  };

  const handleBulkGenerate = async () => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Auto-allocate and generate ${selectedOrders.length} orders?`)) return;

    setProcessing(true);
    for (const id of selectedOrders) {
      const order = orders.find(o => o.id === id);
      if (!order) continue;

      const autoAllocations: Record<string, string> = {};
      order.lines.forEach((line: any) => { autoAllocations[line.id] = "AUTO"; });

      try {
        await fetch("/api/orders/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_LINES",
          id: activeOrder.id,
          totalAmount: newTotal,
          lines: editLines
        })
      });
      if (res.ok) {
        alert("Order items updated successfully!");
        await fetchPipelineData();
        setView("list");
      }
    } catch(e) { alert("Error saving edits"); }
    finally { setProcessing(false); }
  };

  const handleUpdateOrder = async (targetStatus: string) => {
    if (targetStatus === "DISPATCHED" && !bookingRef) return alert("Please enter tracking reference.");
    setProcessing(true);
    const combinedTracking = `${courierName} | ${bookingRef}`;
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "DISPATCH",
          id: activeOrder.id, 
          status: targetStatus, 
          bookingNumber: combinedTracking,
          courierName: courierName,
          trackingNumber: bookingRef,
          deliveryCharges: Number(deliveryFee) || 0,
          paymentStatus: paymentStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchPipelineData();
        setView("list");
        setActiveOrder(null);
      } else alert("Update failed");
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const handleGenerateOrder = async () => {
    setProcessing(true);
    const combinedTracking = bookingRef ? `${courierName} | ${bookingRef}` : "";
    try {
      const res = await fetch("/api/orders/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: activeOrder.id, 
          allocations,
          courierName,
          bookingRef: combinedTracking,
          deliveryFee: Number(deliveryFee) || 0,
          paymentStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Order generated and draft invoice created!");
        await fetchPipelineData();
        setView("list");
        setActiveOrder(null);
      } else {
        alert("Generation failed: " + data.error);
      }
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const openManage = (order: any) => {
    setActiveOrder(order);
    setEditLines(order.lines.map((l: any) => ({
      id: l.id,
      productId: l.productId,
      name: l.product?.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal
    })));

    const initialAllocations: Record<string, string> = {};
    order.lines.forEach((line: any) => { initialAllocations[line.id] = "AUTO"; });
    setAllocations(initialAllocations);

    const trackingStr = order.bookingNumber || "";
    if (trackingStr.includes(" | ")) {
      const [cName, ref] = trackingStr.split(" | ");
      setCourierName(cName);
      setBookingRef(ref);
    } else {
      setCourierName("TCS");
      setBookingRef(trackingStr);
    }
    setDeliveryFee(Number(order.deliveryCharges) || 0);
    setPaymentStatus(order.paymentStatus || "PENDING");
    setView("manage");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(val || 0).replace("PKR", "Rs ");
  };

  if (loading) return <div className="min-h-screen bg-[#0B1121] flex items-center justify-center text-slate-400">Loading pipeline...</div>;

  return (
    <>
      <div className="no-print min-h-screen bg-[#0B1121] text-slate-200 p-6 font-sans relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Order Pipeline</h1>
            <p className="text-sm text-slate-400 mt-1">Manage e-commerce fulfillment and logistics</p>
          </div>
          {view === "list" && (
            <button onClick={() => setView("create")} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Order
            </button>
          )}
          {view !== "list" && (
            <button onClick={() => setView("list")} className="bg-[#131C2F] border border-slate-700 text-slate-300 hover:text-white px-5 py-2.5 rounded-lg font-bold transition-all">
              Back to Pipeline
            </button>
          )}
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto custom-scrollbar border-b border-slate-800 pb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedOrders([]); }}
                  className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.id ? "border-blue-500 text-blue-400 bg-blue-500/5" : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-[#131C2F] rounded-2xl border border-slate-800/60 p-12 flex flex-col items-center justify-center text-slate-500">
                <PackageOpen className="w-12 h-12 mb-4 opacity-50" />
                <p>No orders currently in this stage.</p>
              </div>
            ) : (
              <div className="bg-[#131C2F] rounded-xl border border-slate-800/60 overflow-hidden">
                {activeTab === "SALE_ORDER" && selectedOrders.length > 0 && (
                  <div className="bg-blue-900/20 p-4 flex justify-between items-center border-b border-slate-800/60">
                    <span className="text-sm font-bold text-blue-400">{selectedOrders.length} orders selected</span>
                    <button 
                      onClick={handleBulkGenerate}
                      disabled={processing}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition"
                    >
                      {processing ? "Generating..." : "Confirm All (Auto-Allocate)"}
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap !bg-[#131C2F]">
                    <thead className="!bg-[#0B1121] !text-slate-400 text-[11px] uppercase tracking-wider">
                      <tr>
                        {activeTab === "SALE_ORDER" && (
                          <th className="p-4 w-12 text-center !border-b !border-slate-800">
                            <input 
                              type="checkbox" 
                              className="accent-blue-500 w-4 h-4 rounded"
                              checked={selectedOrders.length === filteredOrders.length}
                              onChange={(e) => e.target.checked ? setSelectedOrders(filteredOrders.map(o => o.id)) : setSelectedOrders([])}
                            />
                          </th>
                        )}
                        <th className="p-4 font-semibold !border-b !border-slate-800">Order #</th>
                        <th className="p-4 font-semibold !border-b !border-slate-800">Customer</th>
                        <th className="p-4 font-semibold text-center !border-b !border-slate-800">Items</th>
                        <th className="p-4 font-semibold text-right !border-b !border-slate-800">Total</th>
                        <th className="p-4 font-semibold text-center !border-b !border-slate-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="!divide-y !divide-slate-800/50">
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="!bg-[#131C2F] hover:!bg-[#1e293b] transition-colors group">
                          {activeTab === "SALE_ORDER" && (
                            <td className="p-4 text-center">
                              <input 
                                type="checkbox" 
                                className="accent-blue-500 w-4 h-4 rounded"
                                checked={selectedOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                                  else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                                }}
                              />
                            </td>
                          )}
                          <td className="p-4 font-bold !text-white">{order.orderNumber}</td>
                          <td className="p-4 !text-slate-300">{order.customer?.name}</td>
                          <td className="p-4 text-center !text-slate-400">{order.lines.length}</td>
                          <td className="p-4 text-right font-bold !text-emerald-400">{formatCurrency(Number(order.totalAmount))}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setViewingOrder(order)} className="!text-slate-300 hover:!text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                                <Eye className="w-3 h-3" /> View
                              </button>
                              <button onClick={() => openManage(order)} className="!text-blue-400 hover:!text-blue-300 flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                                <Edit className="w-3 h-3" /> Edit/Action
                              </button>
                              {activeTab === "SALE_ORDER" && (
                                <button onClick={() => handleDeleteOrder(order.id)} className="!text-red-400 hover:!text-red-300 flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                                  <Trash2 className="w-3 h-3" /> Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW */}
        {view === "create" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#131C2F] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Select Products</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {products.map(p => (
                  <div key={p.id} className="bg-[#0B1121] border border-slate-800 rounded-xl p-4 hover:border-blue-500/50 cursor-pointer" onClick={() => {
                    setCart(prev => {
                      const exists = prev.find(i => i.id === p.id);
                      if (exists) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
                      return [...prev, { ...p, qty: 1 }];
                    });
                  }}>
                    <p className="font-bold text-sm text-white truncate">{p.name}</p>
                    <p className="text-emerald-400 font-bold mt-2">{formatCurrency(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-[#131C2F] border border-slate-800 rounded-2xl p-6 flex flex-col h-[70vh]">
              <h2 className="text-lg font-bold text-white mb-4">Order Details</h2>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full !bg-[#0B1121] !text-white border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none mb-6 appearance-none">
                <option value="" className="text-slate-400">Select a customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <div className="flex-1 overflow-y-auto border-t border-slate-800 pt-4 space-y-3 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-[#0B1121] p-3 rounded-lg border border-slate-800">
                    <div className="overflow-hidden pr-2">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">Qty: {item.qty} x {formatCurrency(item.price)}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">{formatCurrency(item.qty * item.price)}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-800 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-400 font-medium">Draft Total</span>
                  <span className="text-xl font-black text-white">{formatCurrency(subtotal)}</span>
                </div>
                <button onClick={handleCreateOrder} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                  {processing ? "Saving..." : "Save Draft Order"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MANAGE VIEW (EDIT / ALLOCATE) */}
        {view === "manage" && activeOrder && (
          <div className="max-w-5xl mx-auto bg-[#131C2F] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#0B1121] p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white">{activeOrder.orderNumber}</h2>
                <p className="text-slate-400 mt-1">Customer: <span className="text-white font-bold">{activeOrder.customer?.name}</span></p>
              </div>
              <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase border border-blue-500/20">
                {activeOrder.status.replace("_", " ")}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                  {activeOrder.status === "SALE_ORDER" ? "Mini Invoice Editor & Batch Allocation" : "Order Items"}
                </h3>
                
                {activeOrder.status === "SALE_ORDER" ? (
                  <div className="bg-[#0B1121] rounded-xl border border-slate-800 p-4">
                    <table className="w-full text-left text-sm">
                      <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                        <tr>
                          <th className="pb-2">Product / Batch</th>
                          <th className="pb-2 text-center">Req</th>
                          <th className="pb-2 text-right">Price</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {editLines.map((line, idx) => {
                          const originalLine = activeOrder.lines.find((l:any) => l.id === line.id) || { product: { stockBatches: [] } };
                          const batches = originalLine.product?.stockBatches || [];
                          const totalAvailable = batches.reduce((sum: number, b: any) => sum + Number(b.quantity), 0);
                          const isShort = Number(line.quantity) > totalAvailable;
                          
                          return (
                            <tr key={idx}>
                              <td className="py-3 pr-2">
                                <p className="font-bold text-white text-xs mb-1">{line.name}</p>
                                <select
                                  value={allocations[line.id] || "AUTO"}
                                  onChange={e => setAllocations({...allocations, [line.id]: e.target.value})}
                                  className={`w-full bg-[#131C2F] text-white border p-1 text-[10px] rounded outline-none ${isShort ? 'border-red-500/50' : 'border-slate-700'}`}
                                >
                                  <option value="AUTO">Auto (FIFO)</option>
                                  {batches.map((sb: any) => (
                                    <option key={sb.id} value={sb.batch?.id}>{sb.batch?.batchNumber} (Avail: {sb.quantity})</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 text-center">
                                <input type="number" min="1" value={line.quantity} onChange={(e) => {
                                  const newQty = Number(e.target.value);
                                  const updated = [...editLines];
                                  updated[idx].quantity = newQty;
                                  updated[idx].subtotal = newQty * Number(line.unitPrice);
                                  setEditLines(updated);
                                }} className="w-12 bg-transparent text-center font-bold text-white border-b border-slate-600 outline-none"/>
                              </td>
                              <td className="py-3 text-right font-bold text-emerald-400 text-xs">{formatCurrency(line.subtotal)}</td>
                              <td className="py-3 text-right">
                                <button onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    {/* Add New Item Row */}
                    <div className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
                      <select id="add-product-select" className="flex-1 bg-[#131C2F] text-white border border-slate-700 rounded p-2 text-xs outline-none">
                        <option value="">+ Add Product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>)}
                      </select>
                      <button onClick={() => {
                        const sel = document.getElementById("add-product-select") as HTMLSelectElement;
                        const pId = sel.value;
                        if(!pId) return;
                        const product = products.find(p => p.id === pId);
                        setEditLines([...editLines, { id: `temp-${Date.now()}`, productId: product.id, name: product.name, quantity: 1, unitPrice: product.price, subtotal: product.price }]);
                        sel.value = "";
                      }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded flex items-center justify-center"><PlusCircle className="w-4 h-4"/></button>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button onClick={handleSaveEdits} disabled={processing} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-bold uppercase tracking-wider">
                        {processing ? "Saving..." : "Save Line Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOrder.lines.map((line: any) => (
                      <div key={line.id} className="flex justify-between items-center border-b border-slate-800/50 pb-3">
                        <div>
                          <p className="text-sm font-bold text-white">{line.product?.name}</p>
                          <p className="text-xs text-slate-500">Qty: {line.quantity} x {formatCurrency(Number(line.unitPrice))}</p>
                        </div>
                        <p className="font-bold text-slate-300">{formatCurrency(Number(line.subtotal))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#0B1121] p-6 rounded-xl border border-slate-800 h-fit">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Processing Actions
                </h3>
                
                {activeOrder.status === "SALE_ORDER" && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Confirming this order will permanently deduct the selected batches and post a formal Draft Sales Invoice. (Save any line edits above before generating).
                    </p>
                    <button onClick={handleGenerateOrder} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm transition">
                      {processing ? "Generating..." : "Generate & Deduct Stock"}
                    </button>
                  </div>
                )}

                {activeOrder.status === "CONFIRMATION" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Courier</label>
                        <input type="text" placeholder="e.g TCS" value={courierName} onChange={e => setCourierName(e.target.value)} className="w-full !bg-[#131C2F] !text-white placeholder-slate-600 border border-slate-700 rounded-lg p-2.5 text-sm outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tracking *</label>
                        <input type="text" placeholder="e.g. 772837332" value={bookingRef} onChange={e => setBookingRef(e.target.value)} className="w-full !bg-[#131C2F] !text-white placeholder-slate-600 border border-slate-700 rounded-lg p-2.5 text-sm outline-none" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Actual Delivery Rs</label>
                        <input type="number" placeholder="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} className="w-full !bg-[#131C2F] !text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode</label>
                        <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full !bg-[#131C2F] !text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none appearance-none">
                          <option value="PENDING">COD</option>
                          <option value="PAID">NON-COD (Pre-paid)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button onClick={() => window.print()} className="flex-1 bg-[#131C2F] hover:bg-slate-800 border border-slate-700 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2">
                        <Printer className="w-4 h-4" /> Slip
                      </button>
                      <button onClick={() => handleUpdateOrder("DISPATCHED")} disabled={processing} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg text-sm transition">
                        Dispatch & Update Invoice
                      </button>
                    </div>
                  </div>
                )}

                {activeOrder.status === "DISPATCHED" && (
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Tracking Ref</p>
                      <p className="font-bold text-blue-400">{bookingRef || "N/A"}</p>
                    </div>
                    <button onClick={() => window.print()} className="w-full bg-[#131C2F] hover:bg-slate-800 border border-slate-700 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition">
                      <Printer className="w-4 h-4" /> Print Slip
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODAL (Read-Only Summary) */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#131C2F] border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0B1121]">
              <h2 className="text-xl font-bold text-white">Order {viewingOrder.orderNumber}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-slate-500 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 text-slate-300 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Details</p>
                <p className="font-bold text-white">{viewingOrder.customer?.name}</p>
                <p className="text-sm mt-1">{viewingOrder.customer?.phone || "No phone provided"}</p>
                <p className="text-sm mt-1">{viewingOrder.customer?.address || "No address provided"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Order Items</p>
                <div className="bg-[#0B1121] rounded-lg border border-slate-800 p-4 space-y-3">
                  {viewingOrder.lines.map((l:any) => (
                    <div key={l.id} className="flex justify-between items-center text-sm border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                      <span>{l.quantity}x {l.product?.name}</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(Number(l.subtotal))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <span className="font-bold text-slate-400">Total Amount</span>
                <span className="text-2xl font-black text-white">{formatCurrency(Number(viewingOrder.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL PRINTER RECEIPT (Hidden on screen, shown in print) */}
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
            Collect Amt: {paymentStatus === "PENDING" ? formatCurrency(Number(activeOrder.totalAmount) + Number(deliveryFee)) : "Rs 0"}
          </div>
          
          <div className="font-bold mt-1 mb-1">--------------------------------</div>
          <div className="mt-4">Shipper Sign: ________________</div>
          <div className="mt-6 mb-2">Courier Sign: ________________</div>
          <div className="text-center font-bold">================================</div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #131C2F inset !important;
            -webkit-text-fill-color: #e2e8f0 !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.8); }
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
