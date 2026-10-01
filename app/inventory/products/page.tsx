"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { 
  Package, PlusCircle, UploadCloud, Search, AlertCircle, 
  CheckCircle2, X, Edit, Trash2, Globe, Layers, Archive, 
  FileSpreadsheet, Loader2
} from "lucide-react";

type Lookup = { id: string; name: string; };
type Warehouse = { id: string; name: string; code: string; isActive: boolean; };
type Account = { id: string; code: string; name: string; };

type Batch = {
  id: string;
  batchNumber: string;
  unitCost: string | number;
  originalQuantity: string | number;
  purchaseDate: string;
  isActive: boolean;
  stock: { warehouseId: string; quantity: string | number; warehouse: Warehouse; }[];
};

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: "PRODUCT" | "SERVICE";
  costPrice: string | number;
  salePrice: string | number;
  reorderLevel: string | number;
  isActive: boolean;
  useDefaultAccounts: boolean;
  category: Lookup | null;
  brand: Lookup | null;
  unit: Lookup | null;
  stock: { quantity: string | number; averageCost: string | number; }[];
  batches: Batch[];
};

type ProductForm = {
  sku: string;
  name: string;
  description: string;
  type: "PRODUCT" | "SERVICE";
  categoryId: string;
  brandId: string;
  unitId: string;
  costPrice: string;
  salePrice: string;
  reorderLevel: string;
  inventoryAccountId: string;
  salesAccountId: string;
  cogsAccountId: string;
  purchaseAccountId: string;
  isActive: boolean;
  useDefaultAccounts: boolean;
};

type OpeningStockForm = {
  warehouseId: string;
  batchNumber: string;
  quantity: string;
  unitCost: string;
  purchaseDate: string;
};

const emptyForm: ProductForm = {
  sku: "", name: "", description: "", type: "PRODUCT", categoryId: "", brandId: "", unitId: "", costPrice: "0", salePrice: "0", reorderLevel: "0", inventoryAccountId: "", salesAccountId: "", cogsAccountId: "", purchaseAccountId: "", isActive: true, useDefaultAccounts: true,
};

function today() { return new Date().toISOString().slice(0, 10); }

function emptyOpeningStock(): OpeningStockForm {
  return { warehouseId: "", batchNumber: "", quantity: "", unitCost: "", purchaseDate: today(), };
}

function formatAmount(value: string | number) {
  return Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2, });
}

function formatQuantity(value: string | number) {
  return Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 3, });
}

function totalStock(product: Product) {
  return product.stock.reduce((total, row) => total + Number(row.quantity || 0), 0);
}

export default function ProductsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { config: generalConfig } = useERPConfig("general");
  const currency = generalConfig?.currency || "PKR";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [brands, setBrands] = useState<Lookup[]>([]);
  const [units, setUnits] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingSaving, setOpeningSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showOpeningStock, setShowOpeningStock] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importStep, setImportStep] = useState<"UPLOAD" | "MAP" | "IMPORTING">("UPLOAD");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<{ warehouseId: string; batchNumber: string; quantity: string; unitCost: string; purchaseDate: string; }>({
    warehouseId: "", batchNumber: "", quantity: "", unitCost: "", purchaseDate: today(),
  });

  const [batchSaving, setBatchSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [openingStock, setOpeningStock] = useState<OpeningStockForm>(emptyOpeningStock());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProducts() {
    try {
      setLoading(true); setError("");
      const response = await fetch("/api/products", { cache: "no-store", });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load products");

      setProducts(data.products || []);
      setCategories(data.categories || []);
      setBrands(data.brands || []);
      setUnits(data.units || []);
      setAccounts(data.accounts || []);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.description, product.category?.name, product.brand?.name]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  const activeProducts = products.filter((product) => product.isActive);
  const totalUnits = products.reduce((total, product) => total + totalStock(product), 0);

  function updateField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value, }));
  }

  function updateOpeningField<K extends keyof OpeningStockForm>(field: K, value: OpeningStockForm[K]) {
    setOpeningStock((current) => ({ ...current, [field]: value, }));
  }

  function openNewProduct() {
    setError(""); setSuccess(""); setEditingProductId(null); setForm(emptyForm); setShowForm(true);
  }

  function openEditProduct(product: Product) {
    setError(""); setSuccess(""); setEditingProductId(product.id);
    setForm({
      sku: product.sku, name: product.name, description: product.description || "", type: product.type,
      categoryId: product.category?.id || "", brandId: product.brand?.id || "", unitId: product.unit?.id || "",
      costPrice: String(product.costPrice ?? 0), salePrice: String(product.salePrice ?? 0), reorderLevel: String(product.reorderLevel ?? 0),
      inventoryAccountId: "", salesAccountId: "", cogsAccountId: "", purchaseAccountId: "",
      isActive: product.isActive, useDefaultAccounts: product.useDefaultAccounts ?? true,
    });
    setShowForm(true);
  }

  function openOpeningStock(product: Product) {
    setError(""); setSuccess(""); setSelectedProduct(product);
    setOpeningStock({ ...emptyOpeningStock(), unitCost: String(product.costPrice || ""), });
    setShowOpeningStock(true);
  }

  function openEditBatch(batch: Batch) {
    const stock = batch.stock[0];
    setError(""); setSuccess(""); setEditingBatchId(batch.id);
    setEditingBatch({
      warehouseId: stock?.warehouseId || "", batchNumber: batch.batchNumber,
      quantity: String(stock?.quantity ?? batch.originalQuantity ?? ""), unitCost: String(batch.unitCost ?? ""),
      purchaseDate: batch.purchaseDate ? new Date(batch.purchaseDate).toISOString().slice(0, 10) : today(),
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true); setError(""); setSuccess("Reading Excel file...");
    const formData = new FormData(); formData.append("file", file);

    try {
      const res = await fetch("/api/inventory/import", { method: "POST", body: formData, });
      const data = await res.json();
      
      if (res.ok) {
        setExcelHeaders(data.headers); setExcelRows(data.rows);
        const autoMap: Record<string, string> = {};
        const fields = [
          { key: "name", label: "Product Name" }, { key: "sku", label: "SKU" }, { key: "type", label: "Product Type" },
          { key: "category", label: "Category" }, { key: "brand", label: "Brand" }, { key: "unit", label: "Units" },
          { key: "costPrice", label: "Cost Price" }, { key: "salePrice", label: "Sale Price" }
        ];
        
        fields.forEach((f) => {
          const match = data.headers.find((h: string) => h.toLowerCase().trim() === f.label.toLowerCase().trim() || h.toLowerCase().includes(f.key.toLowerCase()));
          if (match) autoMap[f.key] = match;
        });
        
        setColumnMapping(autoMap); setImportStep("MAP"); setSuccess("");
      } else {
        setSuccess(""); setError("❌ " + (data.error || "Failed to read file."));
      }
    } catch (err) {
      setSuccess(""); setError("❌ A network error occurred.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function processImport() {
    if (!columnMapping.name || !columnMapping.sku) {
      setError("❌ Product Name and SKU must be mapped."); return;
    }

    setImportStep("IMPORTING"); setError(""); setSuccess("Importing products into database...");

    const mappedProducts = excelRows.map((row) => ({
      name: row[columnMapping.name], sku: row[columnMapping.sku],
      type: columnMapping.type ? row[columnMapping.type] : "PRODUCT",
      category: columnMapping.category ? row[columnMapping.category] : "",
      brand: columnMapping.brand ? row[columnMapping.brand] : "",
      unit: columnMapping.unit ? row[columnMapping.unit] : "",
      costPrice: columnMapping.costPrice ? row[columnMapping.costPrice] : 0,
      salePrice: columnMapping.salePrice ? row[columnMapping.salePrice] : 0,
    }));

    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: mappedProducts }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess("✨ " + (data.message || "Import successful!"));
        setTimeout(() => {
          setShowImportModal(false); setImportStep("UPLOAD"); setExcelHeaders([]); setExcelRows([]); setSuccess("");
          router.refresh(); loadProducts();
        }, 2500);
      } else {
        setSuccess(""); setError("❌ " + (data.error || "Import failed.")); setImportStep("MAP");
      }
    } catch (err) {
      setSuccess(""); setError("❌ A network error occurred."); setImportStep("MAP");
    }
  }

  async function handleUpdateBatch(event: FormEvent) {
    event.preventDefault();
    if (!editingBatchId) return;

    const quantity = Number(editingBatch.quantity); const unitCost = Number(editingBatch.unitCost);
    if (!editingBatch.warehouseId) { setError("Please select a warehouse."); return; }
    if (!editingBatch.batchNumber.trim()) { setError("Batch number is required."); return; }
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Quantity must be greater than zero."); return; }
    if (!Number.isFinite(unitCost) || unitCost < 0) { setError("Unit cost cannot be negative."); return; }

    try {
      setBatchSaving(true); setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "PUT", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "UPDATE_OPENING_STOCK", batchId: editingBatchId, warehouseId: editingBatch.warehouseId,
          batchNumber: editingBatch.batchNumber.trim(), quantity, unitCost, purchaseDate: editingBatch.purchaseDate,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to update opening stock");

      setEditingBatchId(null); setSuccess("Opening stock updated successfully."); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to update opening stock");
    } finally { setBatchSaving(false); }
  }

  async function handleDeleteBatch(batch: Batch) {
    const confirmed = window.confirm(`DELETE OPENING STOCK\n\nDelete batch "${batch.batchNumber}"?\n\nThis will remove the opening-stock batch and reverse its stock quantity and inventory movement.`);
    if (!confirmed) return;

    try {
      setBatchSaving(true); setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "DELETE", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: "DELETE_OPENING_STOCK", batchId: batch.id, }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete opening stock");

      if (editingBatchId === batch.id) setEditingBatchId(null);
      setSuccess("Opening stock deleted successfully."); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to delete opening stock");
    } finally { setBatchSaving(false); }
  }

  function openBatchViewer(product: Product) {
    setSelectedProduct(product); setShowBatches(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Product name is required."); return; }
    if (!form.sku.trim()) { setError("SKU is required."); return; }
    if (Number(form.costPrice) < 0 || Number(form.salePrice) < 0 || Number(form.reorderLevel) < 0) {
      setError("Prices and reorder level cannot be negative."); return;
    }

    try {
      setSaving(true); setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: editingProductId ? "PUT" : "POST", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: editingProductId, sku: form.sku.trim(), name: form.name.trim(), description: form.description.trim() || null, type: form.type,
          categoryId: form.categoryId || null, brandId: form.brandId || null, unitId: form.unitId || null,
          costPrice: Number(form.costPrice || 0), salePrice: Number(form.salePrice || 0), reorderLevel: Number(form.reorderLevel || 0),
          useDefaultAccounts: form.useDefaultAccounts, inventoryAccountId: form.inventoryAccountId || null, salesAccountId: form.salesAccountId || null,
          cogsAccountId: form.cogsAccountId || null, purchaseAccountId: form.purchaseAccountId || null, isActive: form.isActive,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || `Failed to ${editingProductId ? "update" : "create"} product`);

      setShowForm(false); setEditingProductId(null); setForm(emptyForm);
      setSuccess(editingProductId ? "Product updated successfully." : "Product created successfully.");
      await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to save product");
    } finally { setSaving(false); }
  }

  async function handleOpeningStock(event: FormEvent) {
    event.preventDefault();
    if (!selectedProduct) return;
    if (!openingStock.warehouseId) { setError("Please select a warehouse."); return; }
    if (!openingStock.batchNumber.trim()) { setError("Batch number is required."); return; }

    const quantity = Number(openingStock.quantity); const unitCost = Number(openingStock.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Opening quantity must be greater than zero."); return; }
    if (!Number.isFinite(unitCost) || unitCost < 0) { setError("Unit cost cannot be negative."); return; }

    try {
      setOpeningSaving(true); setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "OPENING_STOCK", productId: selectedProduct.id, warehouseId: openingStock.warehouseId, batchNumber: openingStock.batchNumber.trim(),
          quantity, unitCost, purchaseDate: openingStock.purchaseDate,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to add opening stock");

      setShowOpeningStock(false); setOpeningStock(emptyOpeningStock());
      setSuccess(`Opening stock added to ${selectedProduct.name}.`); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to add opening stock");
    } finally { setOpeningSaving(false); }
  }

  async function editOpeningStock(batch: Batch) {
    const warehouseStock = batch.stock[0];
    if (!warehouseStock) { setError("No warehouse stock record was found for this batch."); return; }

    const batchNumber = window.prompt("Batch number:", batch.batchNumber); if (batchNumber === null) return;
    const quantity = window.prompt("Quantity:", String(batch.stock.reduce((total, stock) => total + Number(stock.quantity || 0), 0))); if (quantity === null) return;
    const unitCost = window.prompt("Unit cost:", String(batch.unitCost)); if (unitCost === null) return;
    const purchaseDate = window.prompt("Opening date (YYYY-MM-DD):", String(batch.purchaseDate).slice(0, 10)); if (purchaseDate === null) return;

    const parsedQuantity = Number(quantity); const parsedUnitCost = Number(unitCost);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setError("Quantity must be greater than zero."); return; }
    if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) { setError("Unit cost cannot be negative."); return; }

    try {
      setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "PUT", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "UPDATE_OPENING_STOCK", batchId: batch.id, warehouseId: warehouseStock.warehouseId,
          batchNumber: batchNumber.trim(), quantity: parsedQuantity, unitCost: parsedUnitCost, purchaseDate,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to update opening stock.");
      setSuccess("Opening stock updated successfully."); setShowBatches(false); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to update opening stock.");
    }
  }

  async function deleteOpeningStock(batch: Batch) {
    const confirmed = window.confirm(`DELETE OPENING STOCK\n\nDelete batch "${batch.batchNumber}"?\n\nThis will remove the opening stock quantity and its inventory movement. This is only allowed if stock from this batch has not already been consumed.`);
    if (!confirmed) return;

    try {
      setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "DELETE", headers: { "Content-Type": "application/json", }, body: JSON.stringify({ action: "DELETE_OPENING_STOCK", batchId: batch.id, }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete opening stock.");
      setSuccess("Opening stock deleted successfully."); setShowBatches(false); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to delete opening stock.");
    }
  }

  async function toggleProductStatus(product: Product) {
    const nextStatus = !product.isActive;
    const confirmed = window.confirm(nextStatus ? `Publish "${product.name}" to Live Storefront?` : `Unpublish "${product.name}" from Storefront?\n\nThe product will be hidden from the public shop but remain available for historical ERP transactions.`);
    if (!confirmed) return;

    try {
      setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "DELETE", headers: { "Content-Type": "application/json", }, body: JSON.stringify({ id: product.id, permanent: false, isActive: nextStatus, }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to update product status");
      setSuccess(nextStatus ? "Product published to storefront 🌐" : "Product unpublished from storefront."); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to update product status");
    }
  }

  async function permanentlyDeleteProduct(product: Product) {
    const confirmed = window.confirm(`PERMANENT DELETE\n\nDelete "${product.name}" permanently?\n\nThis should only be used for a product that has never been used in transactions. Historical records are protected by the database.`);
    if (!confirmed) return;

    try {
      setError(""); setSuccess("");
      const response = await fetch("/api/products", {
        method: "DELETE", headers: { "Content-Type": "application/json", }, body: JSON.stringify({ id: product.id, permanent: true, }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete product");
      setSuccess("Product permanently deleted."); await loadProducts();
    } catch (err) {
      console.error(err); setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  return (
    <div className="space-y-6 relative z-10 w-full pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-500" />
            Products & Catalog
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Manage products, pricing, inventory, batches and accounting configuration.</p>
        </div>
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={() => setShowImportModal(true)}
            className="bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Import
          </button>
          <button 
            type="button" 
            onClick={openNewProduct}
            className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> New Product
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total Products</p>
          <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{products.length}</div>
          <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium flex items-center gap-1"><Package className="w-3 h-3" /> Catalog items</p>
        </div>
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-emerald-200/80 dark:border-emerald-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 text-emerald-500"><Globe className="w-24 h-24" /></div>
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 relative z-10">Live on Storefront</p>
          <div className="text-3xl font-black text-slate-900 dark:text-white mb-1 relative z-10">{activeProducts.length}</div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 font-medium relative z-10">Published & visible to public</p>
        </div>
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total Stock</p>
          <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{formatQuantity(totalUnits)}</div>
          <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium flex items-center gap-1"><Archive className="w-3 h-3" /> Across all warehouses</p>
        </div>
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Batch Tracking</p>
          <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">FIFO</div>
          <p className="text-xs text-slate-500 dark:text-zinc-500 font-medium flex items-center gap-1"><Layers className="w-3 h-3" /> Cost layers enabled</p>
        </div>
      </div>

      {/* PRODUCT FORM MODAL/INLINE */}
      {showForm && (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-6 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Product Setup</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingProductId ? "Edit Product" : "New Product"}</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Configure product information, pricing, and accounting defaults.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="p-2 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg text-slate-500 transition-colors border border-slate-200 dark:border-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* 01 Basic Info */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-2 mb-4 flex items-center gap-2">
                <span className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 text-[10px] px-2 py-0.5 rounded-full font-black">01</span> Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Product Name *</label>
                  <input required value={form.name} onChange={e => updateField("name", e.target.value)} placeholder="e.g. Classic Steel Watch" className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">SKU *</label>
                  <input required value={form.sku} onChange={e => updateField("sku", e.target.value)} placeholder="e.g. WB-001" className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Product Type</label>
                  <select value={form.type} onChange={e => updateField("type", e.target.value as "PRODUCT"|"SERVICE")} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Category</label>
                  <div className="flex gap-2">
                    <select value={form.categoryId} onChange={e => updateField("categoryId", e.target.value)} className="flex-1 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                      <option value="">Select category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={async()=>{const name=window.prompt("New Category Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_CATEGORY",name:name.trim()})});if(!r.ok){alert("Failed to create");return;}const d=await r.json();setCategories(p=>[...p,d.category]);setForm(p=>({...p,categoryId:d.category.id}));}} className="bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 rounded-lg px-3 flex items-center justify-center font-bold transition-colors">+</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Brand</label>
                  <div className="flex gap-2">
                    <select value={form.brandId} onChange={e => updateField("brandId", e.target.value)} className="flex-1 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                      <option value="">Select brand</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <button type="button" onClick={async()=>{const name=window.prompt("New Brand Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_BRAND",name:name.trim()})});if(!r.ok){alert("Failed to create");return;}const d=await r.json();setBrands(p=>[...p,d.brand]);setForm(p=>({...p,brandId:d.brand.id}));}} className="bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 rounded-lg px-3 flex items-center justify-center font-bold transition-colors">+</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Unit</label>
                  <div className="flex gap-2">
                    <select value={form.unitId} onChange={e => updateField("unitId", e.target.value)} className="flex-1 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                      <option value="">Select unit</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button type="button" onClick={async()=>{const name=window.prompt("New Unit Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_UNIT",name:name.trim()})});if(!r.ok){alert("Failed to create");return;}const d=await r.json();setUnits(p=>[...p,d.unit]);setForm(p=>({...p,unitId:d.unit.id}));}} className="bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 rounded-lg px-3 flex items-center justify-center font-bold transition-colors">+</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Description</label>
                  <textarea rows={3} value={form.description} onChange={e => updateField("description", e.target.value)} placeholder="Optional product description" className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors resize-y custom-scrollbar" />
                </div>
              </div>
            </div>

            {/* 02 Pricing & Inventory */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-2 mb-4 flex items-center gap-2">
                <span className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 text-[10px] px-2 py-0.5 rounded-full font-black">02</span> Pricing & Inventory
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50/50 dark:bg-zinc-950/30 p-5 rounded-xl border border-slate-100 dark:border-white/5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
                    <input type="number" min="0" step="0.01" value={form.costPrice} onChange={e => updateField("costPrice", e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 pl-12 text-sm outline-none focus:border-teal-500 transition-colors font-mono font-bold" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Sale Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-500">{currency}</span>
                    <input type="number" min="0" step="0.01" value={form.salePrice} onChange={e => updateField("salePrice", e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-emerald-400 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 pl-12 text-sm outline-none focus:border-teal-500 transition-colors font-mono font-bold" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Reorder Level (Qty)</label>
                  <input type="number" min="0" step="0.001" value={form.reorderLevel} onChange={e => updateField("reorderLevel", e.target.value)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
            </div>

            {/* 03 Accounting */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-2 mb-4 flex items-center gap-2">
                <span className="bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 text-[10px] px-2 py-0.5 rounded-full font-black">03</span> Accounting Link
              </h3>
              
              <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-white/10 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors mb-4">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={form.useDefaultAccounts} onChange={e => updateField("useDefaultAccounts", e.target.checked)} className="peer sr-only" />
                  <div className="w-10 h-6 bg-slate-200 dark:bg-zinc-700 rounded-full peer-checked:bg-teal-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                </div>
                <div>
                  <strong className="text-sm text-slate-900 dark:text-white block">Use Global Default Accounts</strong>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">Automatically route transactions to standard settings</span>
                </div>
              </label>

              {!form.useDefaultAccounts && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-200 dark:border-white/10 rounded-xl">
                  {[["inventoryAccountId", "Inventory account"], ["salesAccountId", "Sales account"], ["cogsAccountId", "COGS account"], ["purchaseAccountId", "Purchase account"]].map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">{label}</label>
                      <select value={form[field as keyof ProductForm] as string} onChange={e => updateField(field as keyof ProductForm, e.target.value as never)} className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                        <option value="">Select account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Toggle */}
            <div className="border-t border-slate-200 dark:border-white/10 pt-6">
              <label className={`flex items-center gap-4 p-5 border rounded-xl cursor-pointer transition-colors ${form.isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-white/10'}`}>
                <div className="relative flex items-center">
                  <input type="checkbox" checked={form.isActive} onChange={e => updateField("isActive", e.target.checked)} className="peer sr-only" />
                  <div className={`w-12 h-7 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'}`}></div>
                  <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                </div>
                <div>
                  <strong className={`text-sm block ${form.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-zinc-300'}`}>Publish to Shop (Live) <Globe className="w-4 h-4 inline ml-1 mb-0.5" /></strong>
                  <span className="text-xs text-slate-500 dark:text-zinc-500">Visible on public storefront & available for ERP transactions</span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50">
                {saving ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATALOG LIST TABLE */}
      <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-sm flex flex-col min-h-[50vh]">
        <div className="p-5 border-b border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-zinc-950/30">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Product Catalog</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Showing {filteredProducts.length} items</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:border-teal-500 transition-colors shadow-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-teal-500" />
              <p className="text-sm font-medium">Loading catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-zinc-600"><Package className="w-8 h-8" /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{products.length === 0 ? "No products yet" : "No matches found"}</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mb-6">{products.length === 0 ? "Create your first product to start managing inventory and sales." : "Try searching by name, SKU, or brand."}</p>
              {products.length === 0 && (
                <button type="button" onClick={openNewProduct} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Create Product
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5 z-10">
                <tr>
                  <th className="p-4 pl-6">Product</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Cost</th>
                  <th className="p-4">Sale Price</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredProducts.map(product => {
                  const quantity = totalStock(product);
                  const lowStock = product.type === "PRODUCT" && quantity <= Number(product.reorderLevel || 0);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{product.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-zinc-300">{product.category?.name || "—"}</td>
                      <td className="p-4 text-slate-600 dark:text-zinc-300">{product.brand?.name || "—"}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold font-mono border ${lowStock ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-zinc-300'}`}>
                          {formatQuantity(quantity)}
                        </span>
                        {lowStock && <span className="block text-[10px] font-bold text-rose-500 uppercase mt-1">Low Stock</span>}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{currency} {formatAmount(product.costPrice)}</td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currency} {formatAmount(product.salePrice)}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${product.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-zinc-400'}`}>
                          {product.isActive ? <><Globe className="w-3 h-3" /> Live</> : "Draft"}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {product.type === "PRODUCT" && (
                            <>
                              <button onClick={() => openOpeningStock(product)} title="Add Opening Stock" className="p-2 text-slate-400 hover:text-teal-600 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg hover:shadow-sm transition-all"><PlusCircle className="w-4 h-4" /></button>
                              <button onClick={() => openBatchViewer(product)} title="View Batches" className="p-2 text-slate-400 hover:text-teal-600 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg hover:shadow-sm transition-all"><Layers className="w-4 h-4" /></button>
                            </>
                          )}
                          <button onClick={() => toggleProductStatus(product)} title={product.isActive ? "Unpublish" : "Publish to Shop"} className="p-2 text-slate-400 hover:text-emerald-600 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg hover:shadow-sm transition-all"><Globe className="w-4 h-4" /></button>
                          <button onClick={() => openEditProduct(product)} title="Edit Product" className="p-2 text-slate-400 hover:text-blue-600 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg hover:shadow-sm transition-all"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => permanentlyDeleteProduct(product)} title="Permanent Delete" className="p-2 text-rose-400 hover:text-white hover:bg-rose-500 border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:shadow-sm transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* OPENING STOCK MODAL */}
      {showOpeningStock && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Inventory</p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Opening Stock</h2>
              </div>
              <button onClick={() => setShowOpeningStock(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-zinc-950">
              <p className="text-sm text-slate-600 dark:text-zinc-300">Add the initial batch and cost layer for <strong className="text-slate-900 dark:text-white">{selectedProduct.name}</strong>.</p>
            </div>

            <form onSubmit={handleOpeningStock} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Warehouse *</label>
                  <select required value={openingStock.warehouseId} onChange={e => updateOpeningField("warehouseId", e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                    <option value="">Select warehouse</option>
                    {warehouses.filter(w => w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Batch Number *</label>
                  <input required value={openingStock.batchNumber} onChange={e => updateOpeningField("batchNumber", e.target.value)} placeholder="e.g. OPENING-001" className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors font-mono" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Quantity *</label>
                  <input required type="number" min="0.001" step="0.001" value={openingStock.quantity} onChange={e => updateOpeningField("quantity", e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors font-mono font-bold" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Unit Cost *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency}</span>
                    <input required type="number" min="0" step="0.01" value={openingStock.unitCost} onChange={e => updateOpeningField("unitCost", e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 pl-12 text-sm outline-none focus:border-teal-500 transition-colors font-mono" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">Opening Date *</label>
                  <input required type="date" value={openingStock.purchaseDate} onChange={e => updateOpeningField("purchaseDate", e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl flex gap-3 text-blue-800 dark:text-blue-300">
                <Layers className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sm block mb-1">FIFO Batch Layer</strong>
                  <p className="text-xs">This creates a separate inventory cost layer. Future sales will consume this batch according to FIFO allocation.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowOpeningStock(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={openingSaving} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50">
                  {openingSaving ? "Adding..." : "Add Opening Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH VIEWER MODAL */}
      {showBatches && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-6 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Inventory Layers</p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedProduct.name}</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">SKU {selectedProduct.sku} · {selectedProduct.batches.length} batch{selectedProduct.batches.length === 1 ? "" : "es"}</p>
              </div>
              <button onClick={() => setShowBatches(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {editingBatchId && (
                <form onSubmit={handleUpdateBatch} className="bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-5 mb-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Edit Opening Stock Batch</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse *</label>
                      <select required value={editingBatch.warehouseId} onChange={e => setEditingBatch(c => ({...c, warehouseId: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none focus:border-teal-500">
                        <option value="">Select warehouse</option>
                        {warehouses.filter(w => w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Batch *</label>
                      <input required value={editingBatch.batchNumber} onChange={e => setEditingBatch(c => ({...c, batchNumber: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Qty *</label>
                      <input required type="number" min="0.001" step="0.001" value={editingBatch.quantity} onChange={e => setEditingBatch(c => ({...c, quantity: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cost *</label>
                      <input required type="number" min="0" step="0.01" value={editingBatch.unitCost} onChange={e => setEditingBatch(c => ({...c, unitCost: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none focus:border-teal-500" />
                    </div>
                    <div className="md:col-span-5 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Date *</label>
                      <input required type="date" value={editingBatch.purchaseDate} onChange={e => setEditingBatch(c => ({...c, purchaseDate: e.target.value}))} className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm outline-none focus:border-teal-500 max-w-[200px]" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                    <button type="button" onClick={() => setEditingBatchId(null)} disabled={batchSaving} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10">Cancel</button>
                    <button type="submit" disabled={batchSaving} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">{batchSaving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              )}

              {selectedProduct.batches.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-200 dark:border-white/10">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300 dark:text-zinc-600 shadow-sm"><Layers className="w-6 h-6" /></div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No batches yet</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Add opening stock or receive a purchase to create the first batch.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-zinc-950/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="p-4">Batch No.</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Unit Cost</th>
                        <th className="p-4">Warehouse</th>
                        <th className="p-4">Current Qty</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {[...selectedProduct.batches].sort((a,b)=>new Date(a.purchaseDate).getTime()-new Date(b.purchaseDate).getTime()).map(batch => (
                        <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="p-4 font-bold text-slate-900 dark:text-white font-mono">{batch.batchNumber}</td>
                          <td className="p-4 text-slate-600 dark:text-zinc-300">{new Date(batch.purchaseDate).toLocaleDateString("en-PK")}</td>
                          <td className="p-4 text-slate-500 font-mono">{currency} {formatAmount(batch.unitCost)}</td>
                          <td className="p-4 text-slate-600 dark:text-zinc-300">{batch.stock.length === 0 ? "—" : batch.stock.map(s => s.warehouse.name).join(", ")}</td>
                          <td className="p-4 font-bold font-mono">
                            {formatQuantity(batch.stock.reduce((total, stock) => total + Number(stock.quantity || 0), 0))}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${batch.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-zinc-500'}`}>
                              {batch.isActive ? "Active" : "Closed"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditBatch(batch)} disabled={batchSaving} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded disabled:opacity-50"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteBatch(batch)} disabled={batchSaving} className="text-rose-500 hover:text-rose-700 p-1 bg-rose-50 hover:bg-rose-100 rounded disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-200/60 dark:border-white/5 flex justify-end gap-3 flex-shrink-0 bg-slate-50/50 dark:bg-zinc-950/30">
              <button type="button" onClick={() => setShowBatches(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Close</button>
              <button type="button" onClick={() => { setShowBatches(false); openOpeningStock(selectedProduct); }} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all">
                <PlusCircle className="w-4 h-4" /> Add Stock Layer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTELLIGENT EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="relative p-8">
              <button onClick={() => { if(importStep !== "IMPORTING") { setShowImportModal(false); setImportStep("UPLOAD"); } }} disabled={importStep === "IMPORTING"} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400 transition-colors disabled:opacity-50"><X className="w-5 h-5" /></button>

              {importStep === "UPLOAD" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Import Products</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Add hundreds of items to Izan Bling in seconds.</p>
                  </div>
                  
                  <a href="/api/inventory/import" className="flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> 1. Download Blank Template
                  </a>

                  <div className={`border-2 border-dashed rounded-xl p-8 text-center relative transition-colors ${isUploading ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10' : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-teal-400 dark:hover:border-teal-600'}`}>
                    <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait z-10" />
                    <div className="text-4xl mb-3 flex justify-center">{isUploading ? <Loader2 className="w-10 h-10 animate-spin text-teal-500" /> : <UploadCloud className="w-10 h-10 text-slate-400" />}</div>
                    <div className="font-bold text-slate-900 dark:text-white text-lg mb-1">{isUploading ? "Reading File..." : "2. Upload Excel File"}</div>
                    <div className="text-sm text-slate-500 dark:text-zinc-400">{isUploading ? "Analyzing columns..." : "Drag & drop or click to browse"}</div>
                  </div>
                </div>
              )}

              {importStep === "MAP" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Map Columns</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Match your Excel columns to Izan Bling's database.</p>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {[{ key: "name", label: "Product Name *" }, { key: "sku", label: "SKU (Code) *" }, { key: "type", label: "Product Type" }, { key: "category", label: "Category" }, { key: "brand", label: "Brand" }, { key: "unit", label: "Units" }, { key: "costPrice", label: `Cost Price (${currency})` }, { key: "salePrice", label: `Sale Price (${currency})` }].map((field) => (
                      <div key={field.key} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-white/5 rounded-xl">
                        <strong className="text-xs text-slate-700 dark:text-zinc-300">{field.label}</strong>
                        <select value={columnMapping[field.key] || ""} onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })} className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg w-48 text-xs outline-none focus:border-teal-500">
                          <option value="">-- Skip this field --</option>
                          {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                    <button type="button" onClick={() => { setImportStep("UPLOAD"); setExcelHeaders([]); setExcelRows([]); }} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Back</button>
                    <button type="button" onClick={processImport} className="flex-[2] px-4 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-500 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Proceed & Import</button>
                  </div>
                </div>
              )}

              {importStep === "IMPORTING" && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-50 dark:bg-teal-500/10 rounded-full mb-6">
                    <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Importing Products...</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Please do not close this window.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.6); }
      `}} />
    </div>
  );
}