"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Lookup = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type Account = {
  id: string;
  code: string;
  name: string;
};

type Batch = {
  id: string;
  batchNumber: string;
  unitCost: string | number;
  originalQuantity: string | number;
  purchaseDate: string;
  isActive: boolean;
  stock: {
    warehouseId: string;
    quantity: string | number;
    warehouse: Warehouse;
  }[];
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

  stock: {
    quantity: string | number;
    averageCost: string | number;
  }[];

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
  sku: "",
  name: "",
  description: "",
  type: "PRODUCT",
  categoryId: "",
  brandId: "",
  unitId: "",
  costPrice: "0",
  salePrice: "0",
  reorderLevel: "0",
  inventoryAccountId: "",
  salesAccountId: "",
  cogsAccountId: "",
  purchaseAccountId: "",
  isActive: true,
  useDefaultAccounts: true,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyOpeningStock(): OpeningStockForm {
  return {
    warehouseId: "",
    batchNumber: "",
    quantity: "",
    unitCost: "",
    purchaseDate: today(),
  };
}

function formatAmount(value: string | number) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: string | number) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function totalStock(product: Product) {
  return product.stock.reduce(
    (total, row) => total + Number(row.quantity || 0),
    0
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  // Excel Importer State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importStep, setImportStep] = useState<"UPLOAD" | "MAP" | "IMPORTING">("UPLOAD");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<{
    warehouseId: string;
    batchNumber: string;
    quantity: string;
    unitCost: string;
    purchaseDate: string;
  }>({
    warehouseId: "",
    batchNumber: "",
    quantity: "",
    unitCost: "",
    purchaseDate: today(),
  });

  const [batchSaving, setBatchSaving] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    null
  );

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [openingStock, setOpeningStock] =
    useState<OpeningStockForm>(emptyOpeningStock());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/products", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load products");
      }

      setProducts(data.products || []);
      setCategories(data.categories || []);
      setBrands(data.brands || []);
      setUnits(data.units || []);
      setAccounts(data.accounts || []);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.description,
        product.category?.name,
        product.brand?.name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [products, search]);

  const activeProducts = products.filter(
    (product) => product.isActive
  );

  const totalUnits = products.reduce(
    (total, product) => total + totalStock(product),
    0
  );

  function updateField<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateOpeningField<K extends keyof OpeningStockForm>(
    field: K,
    value: OpeningStockForm[K]
  ) {
    setOpeningStock((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openNewProduct() {
    setError("");
    setSuccess("");
    setEditingProductId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditProduct(product: Product) {
    setError("");
    setSuccess("");
    setEditingProductId(product.id);

    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      type: product.type,
      categoryId: product.category?.id || "",
      brandId: product.brand?.id || "",
      unitId: product.unit?.id || "",
      costPrice: String(product.costPrice ?? 0),
      salePrice: String(product.salePrice ?? 0),
      reorderLevel: String(product.reorderLevel ?? 0),
      inventoryAccountId: "",
      salesAccountId: "",
      cogsAccountId: "",
      purchaseAccountId: "",
      isActive: product.isActive,
      useDefaultAccounts: product.useDefaultAccounts ?? true,
    });

    setShowForm(true);
  }

  function openOpeningStock(product: Product) {
    setError("");
    setSuccess("");
    setSelectedProduct(product);
    setOpeningStock({
      ...emptyOpeningStock(),
      unitCost: String(product.costPrice || ""),
    });
    setShowOpeningStock(true);
  }

  function openEditBatch(batch: Batch) {
    const stock = batch.stock[0];

    setError("");
    setSuccess("");
    setEditingBatchId(batch.id);

    setEditingBatch({
      warehouseId: stock?.warehouseId || "",
      batchNumber: batch.batchNumber,
      quantity: String(stock?.quantity ?? batch.originalQuantity ?? ""),
      unitCost: String(batch.unitCost ?? ""),
      purchaseDate: batch.purchaseDate
        ? new Date(batch.purchaseDate).toISOString().slice(0, 10)
        : today(),
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(""); 
    setSuccess("Reading Excel file...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok) {
        setExcelHeaders(data.headers);
        setExcelRows(data.rows);

        // Auto-match headers to Izan Bling fields
        const autoMap: Record<string, string> = {};
        const fields = [
          { key: "name", label: "Product Name" },
          { key: "sku", label: "SKU" },
          { key: "type", label: "Product Type" },
          { key: "category", label: "Category" },
          { key: "brand", label: "Brand" },
          { key: "unit", label: "Units" },
          { key: "costPrice", label: "Cost Price" },
          { key: "salePrice", label: "Sale Price" }
        ];
        
        fields.forEach((f) => {
          const match = data.headers.find((h: string) => h.toLowerCase().trim() === f.label.toLowerCase().trim() || h.toLowerCase().includes(f.key.toLowerCase()));
          if (match) autoMap[f.key] = match;
        });
        
        setColumnMapping(autoMap);
        setImportStep("MAP");
        setSuccess("");
      } else {
        setSuccess("");
        setError("❌ " + (data.error || "Failed to read file."));
      }
    } catch (err) {
      setSuccess("");
      setError("❌ A network error occurred.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function processImport() {
    if (!columnMapping.name || !columnMapping.sku) {
      setError("❌ Product Name and SKU must be mapped.");
      return;
    }

    setImportStep("IMPORTING");
    setError("");
    setSuccess("Importing products into database...");

    const mappedProducts = excelRows.map((row) => ({
      name: row[columnMapping.name],
      sku: row[columnMapping.sku],
      type: columnMapping.type ? row[columnMapping.type] : "PRODUCT",
      category: columnMapping.category ? row[columnMapping.category] : "",
      brand: columnMapping.brand ? row[columnMapping.brand] : "",
      unit: columnMapping.unit ? row[columnMapping.unit] : "",
      costPrice: columnMapping.costPrice ? row[columnMapping.costPrice] : 0,
      salePrice: columnMapping.salePrice ? row[columnMapping.salePrice] : 0,
    }));

    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: mappedProducts }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess("✨ " + (data.message || "Import successful!"));
        setTimeout(() => {
          setShowImportModal(false);
          setImportStep("UPLOAD");
          setExcelHeaders([]);
          setExcelRows([]);
          setSuccess("");
          router.refresh(); 
          loadProducts();
        }, 2500);
      } else {
        setSuccess("");
        setError("❌ " + (data.error || "Import failed."));
        setImportStep("MAP");
      }
    } catch (err) {
      setSuccess("");
      setError("❌ A network error occurred.");
      setImportStep("MAP");
    }
  }

  async function handleUpdateBatch(event: FormEvent) {
    event.preventDefault();

    if (!editingBatchId) return;

    const quantity = Number(editingBatch.quantity);
    const unitCost = Number(editingBatch.unitCost);

    if (!editingBatch.warehouseId) {
      setError("Please select a warehouse.");
      return;
    }

    if (!editingBatch.batchNumber.trim()) {
      setError("Batch number is required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Unit cost cannot be negative.");
      return;
    }

    try {
      setBatchSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_OPENING_STOCK",
          batchId: editingBatchId,
          warehouseId: editingBatch.warehouseId,
          batchNumber: editingBatch.batchNumber.trim(),
          quantity,
          unitCost,
          purchaseDate: editingBatch.purchaseDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to update opening stock"
        );
      }

      setEditingBatchId(null);
      setSuccess("Opening stock updated successfully.");
      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update opening stock"
      );
    } finally {
      setBatchSaving(false);
    }
  }

  async function handleDeleteBatch(batch: Batch) {
    const confirmed = window.confirm(
      `DELETE OPENING STOCK\n\nDelete batch "${batch.batchNumber}"?\n\nThis will remove the opening-stock batch and reverse its stock quantity and inventory movement.`
    );

    if (!confirmed) return;

    try {
      setBatchSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_OPENING_STOCK",
          batchId: batch.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to delete opening stock"
        );
      }

      if (editingBatchId === batch.id) {
        setEditingBatchId(null);
      }

      setSuccess("Opening stock deleted successfully.");
      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete opening stock"
      );
    } finally {
      setBatchSaving(false);
    }
  }

  function openBatchViewer(product: Product) {
    setSelectedProduct(product);
    setShowBatches(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!form.sku.trim()) {
      setError("SKU is required.");
      return;
    }

    if (
      Number(form.costPrice) < 0 ||
      Number(form.salePrice) < 0 ||
      Number(form.reorderLevel) < 0
    ) {
      setError("Prices and reorder level cannot be negative.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: editingProductId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingProductId,
          sku: form.sku.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type,
          categoryId: form.categoryId || null,
          brandId: form.brandId || null,
          unitId: form.unitId || null,
          costPrice: Number(form.costPrice || 0),
          salePrice: Number(form.salePrice || 0),
          reorderLevel: Number(form.reorderLevel || 0),
          useDefaultAccounts: form.useDefaultAccounts,
          inventoryAccountId: form.inventoryAccountId || null,
          salesAccountId: form.salesAccountId || null,
          cogsAccountId: form.cogsAccountId || null,
          purchaseAccountId: form.purchaseAccountId || null,
          isActive: form.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            `Failed to ${
              editingProductId ? "update" : "create"
            } product`
        );
      }

      setShowForm(false);
      setEditingProductId(null);
      setForm(emptyForm);

      setSuccess(
        editingProductId
          ? "Product updated successfully."
          : "Product created successfully."
      );

      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save product"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleOpeningStock(event: FormEvent) {
    event.preventDefault();

    if (!selectedProduct) return;

    if (!openingStock.warehouseId) {
      setError("Please select a warehouse.");
      return;
    }

    if (!openingStock.batchNumber.trim()) {
      setError("Batch number is required.");
      return;
    }

    const quantity = Number(openingStock.quantity);
    const unitCost = Number(openingStock.unitCost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Opening quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Unit cost cannot be negative.");
      return;
    }

    try {
      setOpeningSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "OPENING_STOCK",
          productId: selectedProduct.id,
          warehouseId: openingStock.warehouseId,
          batchNumber: openingStock.batchNumber.trim(),
          quantity,
          unitCost,
          purchaseDate: openingStock.purchaseDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to add opening stock"
        );
      }

      setShowOpeningStock(false);
      setOpeningStock(emptyOpeningStock());

      setSuccess(
        `Opening stock added to ${selectedProduct.name}.`
      );

      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to add opening stock"
      );
    } finally {
      setOpeningSaving(false);
    }
  }

  async function editOpeningStock(batch: Batch) {
    const warehouseStock = batch.stock[0];

    if (!warehouseStock) {
      setError("No warehouse stock record was found for this batch.");
      return;
    }

    const batchNumber = window.prompt(
      "Batch number:",
      batch.batchNumber
    );

    if (batchNumber === null) return;

    const quantity = window.prompt(
      "Quantity:",
      String(batch.stock.reduce(
        (total, stock) => total + Number(stock.quantity || 0),
        0
      ))
    );

    if (quantity === null) return;

    const unitCost = window.prompt(
      "Unit cost:",
      String(batch.unitCost)
    );

    if (unitCost === null) return;

    const purchaseDate = window.prompt(
      "Opening date (YYYY-MM-DD):",
      String(batch.purchaseDate).slice(0, 10)
    );

    if (purchaseDate === null) return;

    const parsedQuantity = Number(quantity);
    const parsedUnitCost = Number(unitCost);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
      setError("Unit cost cannot be negative.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_OPENING_STOCK",
          batchId: batch.id,
          warehouseId: warehouseStock.warehouseId,
          batchNumber: batchNumber.trim(),
          quantity: parsedQuantity,
          unitCost: parsedUnitCost,
          purchaseDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to update opening stock."
        );
      }

      setSuccess("Opening stock updated successfully.");
      setShowBatches(false);
      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update opening stock."
      );
    }
  }

  async function deleteOpeningStock(batch: Batch) {
    const confirmed = window.confirm(
      `DELETE OPENING STOCK\n\nDelete batch "${batch.batchNumber}"?\n\nThis will remove the opening stock quantity and its inventory movement. This is only allowed if stock from this batch has not already been consumed.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE_OPENING_STOCK",
          batchId: batch.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to delete opening stock."
        );
      }

      setSuccess("Opening stock deleted successfully.");
      setShowBatches(false);
      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete opening stock."
      );
    }
  }

  async function toggleProductStatus(product: Product) {
    const nextStatus = !product.isActive;

    const confirmed = window.confirm(
      nextStatus
        ? `Activate "${product.name}"?`
        : `Deactivate "${product.name}"?\n\nThe product will remain in historical transactions but will no longer be available for new transactions.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          permanent: false,
          isActive: nextStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to update product status"
        );
      }

      setSuccess(
        nextStatus
          ? "Product activated."
          : "Product deactivated."
      );

      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update product status"
      );
    }
  }

  async function permanentlyDeleteProduct(product: Product) {
    const confirmed = window.confirm(
      `PERMANENT DELETE\n\nDelete "${product.name}" permanently?\n\nThis should only be used for a product that has never been used in transactions. Historical records are protected by the database.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          permanent: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to delete product"
        );
      }

      setSuccess("Product permanently deleted.");
      await loadProducts();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete product"
      );
    }
  }

  return (
    <div className="product-page">
      <div className="product-page-header">
        <div>
          <div className="product-eyebrow">
            Inventory / Catalog
          </div>

          <h1>Products</h1>

          <p>
            Manage products, pricing, inventory, batches and
            accounting configuration.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            className="product-secondary-button"
            onClick={() => setShowImportModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            📥 Import Excel
          </button>

          <button
            type="button"
            className="product-primary-button"
            onClick={openNewProduct}
          >
            <span>+</span>
            New Product
          </button>
        </div>
      </div>

      {error && (
        <div className="product-error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="product-success">
          <strong>Done</strong>
          <span>{success}</span>
        </div>
      )}

      <div className="product-stat-grid">
        <div className="product-stat-card">
          <span>Total products</span>
          <strong>{products.length}</strong>
          <small>Catalog items</small>
        </div>

        <div className="product-stat-card">
          <span>Active products</span>
          <strong>{activeProducts.length}</strong>
          <small>Available for transactions</small>
        </div>

        <div className="product-stat-card">
          <span>Total stock</span>
          <strong>{formatQuantity(totalUnits)}</strong>
          <small>Across all warehouses</small>
        </div>

        <div className="product-stat-card">
          <span>Batch tracking</span>
          <strong>FIFO</strong>
          <small>Cost layers enabled</small>
        </div>
      </div>

      {showForm && (
        <section className="product-form-panel">
          <div className="product-form-header">
            <div>
              <span className="product-section-label">
                Product setup
              </span>

              <h2>
                {editingProductId
                  ? "Edit Product"
                  : "New Product"}
              </h2>

              <p>
                Configure product information, pricing and
                accounting defaults.
              </p>
            </div>

            <button
              type="button"
              className="product-close-button"
              onClick={() => setShowForm(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="product-form-section">
              <div className="product-section-title">
                <span>01</span>
                Basic information
              </div>

              <div className="product-form-grid">
                <label>
                  Product name *
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="e.g. Classic Steel Watch"
                    required
                  />
                </label>

                <label>
                  SKU *
                  <input
                    value={form.sku}
                    onChange={(event) =>
                      updateField("sku", event.target.value)
                    }
                    placeholder="e.g. WB-001"
                    required
                  />
                </label>

                <label>
                  Product type
                  <select
                    value={form.type}
                    onChange={(event) =>
                      updateField(
                        "type",
                        event.target.value as
                          | "PRODUCT"
                          | "SERVICE"
                      )
                    }
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </label>

                <label>
                  Category
                  <div style={{display:"flex",gap:6,alignItems:"center"}}><select
                    value={form.categoryId}
                    onChange={(event) =>
                      updateField(
                        "categoryId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Select category</option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select><button type="button" onClick={async()=>{const name=window.prompt("New Category Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_CATEGORY",name:name.trim()})});if(!r.ok){alert("Failed to create category");return}const d=await r.json();setCategories(prev=>[...prev,d.category]);setForm(prev=>({...prev,categoryId:d.category.id}));}}>+</button></div>
                </label>

                <label>
                  Brand
                  <div style={{display:"flex",gap:6,alignItems:"center"}}><select
                    value={form.brandId}
                    onChange={(event) =>
                      updateField(
                        "brandId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Select brand</option>

                    {brands.map((brand) => (
                      <option
                        key={brand.id}
                        value={brand.id}
                      >
                        {brand.name}
                      </option>
                    ))}
                  </select><button type="button" onClick={async()=>{const name=window.prompt("New Brand Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_BRAND",name:name.trim()})});if(!r.ok){alert("Failed to create brand");return}const d=await r.json();setBrands(prev=>[...prev,d.brand]);setForm(prev=>({...prev,brandId:d.brand.id}));}}>+</button></div>
                </label>

                <label>
                  Unit
                  <div style={{display:"flex",gap:6,alignItems:"center"}}><select
                    value={form.unitId}
                    onChange={(event) =>
                      updateField(
                        "unitId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Select unit</option>

                    {units.map((unit) => (
                      <option
                        key={unit.id}
                        value={unit.id}
                      >
                        {unit.name}
                      </option>
                    ))}
                  </select><button type="button" onClick={async()=>{const name=window.prompt("New Unit Name");if(!name?.trim())return;const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_UNIT",name:name.trim()})});if(!r.ok){alert("Failed to create unit");return}const d=await r.json();setUnits(prev=>[...prev,d.unit]);setForm(prev=>({...prev,unitId:d.unit.id}));}}>+</button></div>
                </label>

                <label className="product-full-field">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Optional product description"
                    rows={3}
                  />
                </label>
              </div>
            </div>

            <div className="product-form-section">
              <div className="product-section-title">
                <span>02</span>
                Pricing & inventory
              </div>

              <div className="product-form-grid product-pricing-grid">
                <label>
                  Cost price
                  <div className="product-input-prefix">
                    <span>PKR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPrice}
                      onChange={(event) =>
                        updateField(
                          "costPrice",
                          event.target.value
                        )
                      }
                    />
                  </div>
                </label>

                <label>
                  Sale price
                  <div className="product-input-prefix">
                    <span>PKR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.salePrice}
                      onChange={(event) =>
                        updateField(
                          "salePrice",
                          event.target.value
                        )
                      }
                    />
                  </div>
                </label>

                <label>
                  Reorder level
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.reorderLevel}
                    onChange={(event) =>
                      updateField(
                        "reorderLevel",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="product-form-section">
              <div className="product-section-title">
                <span>03</span>
                Accounting
              </div>

              <p className="product-accounting-help">
                These accounts are product-level defaults for
                purchasing, sales, inventory and COGS.
              </p>

              <label className="product-toggle" style={{ marginBottom: "16px", display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.useDefaultAccounts}
                  onChange={(event) => updateField("useDefaultAccounts", event.target.checked)}
                />
                <span className="product-toggle-track">
                  <span />
                </span>
                <span>
                  <strong style={{ display: "block" }}>Use Global Default Accounts</strong>
                  <small>Automatically route transactions to your standard settings</small>
                </span>
              </label>

              {!form.useDefaultAccounts && (
                <div className="product-form-grid" style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {[
                    [
                      "inventoryAccountId",
                      "Inventory account",
                    ],
                    ["salesAccountId", "Sales account"],
                    ["cogsAccountId", "COGS account"],
                    ["purchaseAccountId", "Purchase account"],
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}

                      <select
                        value={
                          form[
                            field as keyof ProductForm
                          ] as string
                        }
                        onChange={(event) =>
                          updateField(
                            field as keyof ProductForm,
                            event.target.value as never
                          )
                        }
                      >
                        <option value="">
                          Select account
                        </option>

                        {accounts.map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {account.code} — {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="product-form-section product-status-section">
              <label className="product-toggle">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField(
                      "isActive",
                      event.target.checked
                    )
                  }
                />

                <span className="product-toggle-track">
                  <span />
                </span>

                <span>
                  <strong>Active product</strong>
                  <small>
                    Available for future transactions
                  </small>
                </span>
              </label>
            </div>

            <div className="product-form-actions">
              <button
                type="button"
                className="product-secondary-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="product-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingProductId
                  ? "Update Product"
                  : "Save Product"}
              </button>
            </div>
          </form>
        </section>
      )}

      {showOpeningStock && selectedProduct && (
        <section className="product-modal-backdrop">
          <div className="product-modal">
            <div className="product-form-header">
              <div>
                <span className="product-section-label">
                  Inventory
                </span>

                <h2>Opening Stock</h2>

                <p>
                  Add the initial batch and cost layer for{" "}
                  <strong>{selectedProduct.name}</strong>.
                </p>
              </div>

              <button
                type="button"
                className="product-close-button"
                onClick={() => setShowOpeningStock(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleOpeningStock}>
              <div className="product-form-grid">
                <label>
                  Warehouse *
                  <select
                    value={openingStock.warehouseId}
                    onChange={(event) =>
                      updateOpeningField(
                        "warehouseId",
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select warehouse
                    </option>

                    {warehouses
                      .filter((warehouse) => warehouse.isActive)
                      .map((warehouse) => (
                        <option
                          key={warehouse.id}
                          value={warehouse.id}
                        >
                          {warehouse.code} — {warehouse.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Batch number *
                  <input
                    value={openingStock.batchNumber}
                    onChange={(event) =>
                      updateOpeningField(
                        "batchNumber",
                        event.target.value
                      )
                    }
                    placeholder="e.g. OPENING-001"
                    required
                  />
                </label>

                <label>
                  Quantity *
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={openingStock.quantity}
                    onChange={(event) =>
                      updateOpeningField(
                        "quantity",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Unit cost *
                  <div className="product-input-prefix">
                    <span>PKR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingStock.unitCost}
                      onChange={(event) =>
                        updateOpeningField(
                          "unitCost",
                          event.target.value
                        )
                      }
                      required
                    />
                  </div>
                </label>

                <label>
                  Opening date *
                  <input
                    type="date"
                    value={openingStock.purchaseDate}
                    onChange={(event) =>
                      updateOpeningField(
                        "purchaseDate",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>
              </div>

              <div className="product-opening-stock-note">
                <strong>FIFO batch layer</strong>
                <span>
                  This creates a separate inventory cost layer.
                  Future sales can consume this batch according
                  to FIFO allocation.
                </span>
              </div>

              <div className="product-form-actions">
                <button
                  type="button"
                  className="product-secondary-button"
                  onClick={() => setShowOpeningStock(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="product-primary-button"
                  disabled={openingSaving}
                >
                  {openingSaving
                    ? "Adding stock..."
                    : "Add Opening Stock"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {showBatches && selectedProduct && (
        <section className="product-modal-backdrop">
          <div className="product-modal product-batch-modal">
            <div className="product-form-header">
              <div>
                <span className="product-section-label">
                  Inventory layers
                </span>

                <h2>{selectedProduct.name}</h2>

                <p>
                  SKU {selectedProduct.sku} ·{" "}
                  {selectedProduct.batches.length} batch
                  {selectedProduct.batches.length === 1
                    ? ""
                    : "es"}
                </p>
              </div>

              <button
                type="button"
                className="product-close-button"
                onClick={() => setShowBatches(false)}
              >
                ×
              </button>
            </div>

            {editingBatchId && (
              <form
                onSubmit={handleUpdateBatch}
                className="product-form-section"
              >
                <div className="product-section-title">
                  <span>Edit</span>
                  Opening stock batch
                </div>

                <div className="product-form-grid">
                  <label>
                    Warehouse *
                    <select
                      value={editingBatch.warehouseId}
                      onChange={(event) =>
                        setEditingBatch((current) => ({
                          ...current,
                          warehouseId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select warehouse</option>
                      {warehouses
                        .filter((warehouse) => warehouse.isActive)
                        .map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} — {warehouse.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Batch number *
                    <input
                      value={editingBatch.batchNumber}
                      onChange={(event) =>
                        setEditingBatch((current) => ({
                          ...current,
                          batchNumber: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    Quantity *
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={editingBatch.quantity}
                      onChange={(event) =>
                        setEditingBatch((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    Unit cost *
                    <div className="product-input-prefix">
                      <span>PKR</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingBatch.unitCost}
                        onChange={(event) =>
                          setEditingBatch((current) => ({
                            ...current,
                            unitCost: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </label>

                  <label>
                    Opening date *
                    <input
                      type="date"
                      value={editingBatch.purchaseDate}
                      onChange={(event) =>
                        setEditingBatch((current) => ({
                          ...current,
                          purchaseDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>

                <div className="product-form-actions">
                  <button
                    type="button"
                    className="product-secondary-button"
                    onClick={() => setEditingBatchId(null)}
                    disabled={batchSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="product-primary-button"
                    disabled={batchSaving}
                  >
                    {batchSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}


            {selectedProduct.batches.length === 0 ? (
              <div className="product-empty compact">
                <h3>No batches yet</h3>
                <p>
                  Add opening stock or receive a purchase to
                  create the first batch.
                </p>
              </div>
            ) : (
              <div className="product-table-wrapper">
                <table className="product-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Date</th>
                      <th>Unit cost</th>
                      <th>Warehouse</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...selectedProduct.batches]
                      .sort(
                        (a, b) =>
                          new Date(a.purchaseDate).getTime() -
                          new Date(b.purchaseDate).getTime()
                      )
                      .map((batch) => (
                        <tr key={batch.id}>
                          <td>
                            <strong>
                              {batch.batchNumber}
                            </strong>
                          </td>

                          <td>
                            {new Date(
                              batch.purchaseDate
                            ).toLocaleDateString("en-PK")}
                          </td>

                          <td>
                            PKR{" "}
                            {formatAmount(batch.unitCost)}
                          </td>

                          <td>
                            {batch.stock.length === 0
                              ? "—"
                              : batch.stock.map(
                                  (stock) =>
                                    stock.warehouse.name
                                ).join(", ")}
                          </td>

                          <td>
                            {formatQuantity(
                              batch.stock.reduce(
                                (total, stock) =>
                                  total +
                                  Number(
                                    stock.quantity || 0
                                  ),
                                0
                              )
                            )}
                          </td>

                          <td>
                            <span
                              className={`product-status ${
                                batch.isActive
                                  ? "active"
                                  : "inactive"
                              }`}
                            >
                              {batch.isActive
                                ? "Active"
                                : "Closed"}
                            </span>
                          </td>

                          <td>
                            <div className="product-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditBatch(batch)
                                }
                                disabled={batchSaving}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="product-danger-action"
                                onClick={() =>
                                  handleDeleteBatch(batch)
                                }
                                disabled={batchSaving}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="product-form-actions">
              <button
                type="button"
                className="product-secondary-button"
                onClick={() => setShowBatches(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="product-primary-button"
                onClick={() => {
                  setShowBatches(false);
                  openOpeningStock(selectedProduct);
                }}
              >
                + Add Stock Layer
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="product-list-panel">
        <div className="product-list-toolbar">
          <div>
            <span className="product-section-label">
              Catalog
            </span>

            <h2>Product list</h2>

            <p>
              {products.length} product
              {products.length === 1 ? "" : "s"} in your
              catalog
            </p>
          </div>

          <div className="product-search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
            />
          </div>
        </div>

        {loading ? (
          <div className="product-loading">
            <div className="product-loading-spinner" />
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="product-empty">
            <div className="product-empty-icon">P</div>

            <h3>
              {products.length === 0
                ? "No products yet"
                : "No matching products"}
            </h3>

            <p>
              {products.length === 0
                ? "Create your first product to start managing inventory."
                : "Try searching by product name, SKU, category or brand."}
            </p>

            {products.length === 0 && (
              <button
                type="button"
                className="product-primary-button"
                onClick={openNewProduct}
              >
                + Create Product
              </button>
            )}
          </div>
        ) : (
          <div className="product-table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Sale price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const quantity = totalStock(product);

                  const lowStock =
                    product.type === "PRODUCT" &&
                    quantity <=
                      Number(product.reorderLevel || 0);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-avatar">
                            {product.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>{product.name}</strong>
                            <small>{product.sku}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {product.category?.name || "—"}
                      </td>

                      <td>
                        {product.brand?.name || "—"}
                      </td>

                      <td>
                        <span
                          className={
                            lowStock
                              ? "product-stock-low"
                              : "product-stock"
                          }
                        >
                          {formatQuantity(quantity)}
                        </span>

                        {lowStock && (
                          <small className="product-low-label">
                            Low stock
                          </small>
                        )}
                      </td>

                      <td>
                        PKR{" "}
                        {formatAmount(product.costPrice)}
                      </td>

                      <td>
                        <strong>
                          PKR{" "}
                          {formatAmount(product.salePrice)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`product-status ${
                            product.isActive
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {product.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="product-actions">
                          <button
                            type="button"
                            onClick={() =>
                              openEditProduct(product)
                            }
                          >
                            Edit
                          </button>

                          {product.type === "PRODUCT" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openOpeningStock(product)
                                }
                              >
                                Stock
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openBatchViewer(product)
                                }
                              >
                                Batches
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              toggleProductStatus(product)
                            }
                          >
                            {product.isActive
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            className="product-danger-action"
                            onClick={() =>
                              permanentlyDeleteProduct(
                                product
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

            {/* The Magic Intelligent Import Modal */}
      {showImportModal && (
         <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
           <div style={{ background: "white", padding: "32px", borderRadius: "20px", width: "500px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", position: "relative" }}>
             
             {/* Close Button */}
             <button onClick={() => { if(importStep !== "IMPORTING") { setShowImportModal(false); setImportStep("UPLOAD"); } }} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", fontSize: "20px", cursor: importStep === "IMPORTING" ? "not-allowed" : "pointer", color: "#9ca3af" }}>×</button>

             {importStep === "UPLOAD" && (
               <>
                 <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Import Products</h2>
                 <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "28px" }}>
                   Add hundreds of items to Izan Bling in seconds.
                 </p>
                 
                 <a href="/api/inventory/import" style={{ display: "block", textAlign: "center", padding: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a", textDecoration: "none", borderRadius: "10px", fontWeight: 700, marginBottom: "24px", transition: "background 0.2s" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#f1f5f9"}
                    onMouseOut={(e) => e.currentTarget.style.background = "#f8fafc"}
                 >
                   1. Download New Excel Template
                 </a>

                 <div style={{ border: "2px dashed #cbd5e1", borderRadius: "12px", padding: "40px 20px", textAlign: "center", position: "relative", background: isUploading ? "#f8fafc" : "white", transition: "all 0.2s" }}>
                   <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: isUploading ? "wait" : "pointer", zIndex: 10 }} disabled={isUploading} />
                   <div style={{ fontSize: "32px", marginBottom: "12px" }}>{isUploading ? "⏳" : "☁️"}</div>
                   <div style={{ fontWeight: 800, color: "#334155", fontSize: "16px" }}>
                     {isUploading ? "Reading File..." : "2. Upload Excel File"}
                   </div>
                   <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>
                     {isUploading ? "Analyzing columns..." : "Drag & drop or click to browse"}
                   </div>
                 </div>
               </>
             )}

             {importStep === "MAP" && (
               <>
                 <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Map Columns</h2>
                 <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>
                   Match your Excel columns to Izan Bling's database.
                 </p>

                 <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0 16px", marginBottom: "24px" }}>
                   {[
                     { key: "name", label: "Product Name *" },
                     { key: "sku", label: "SKU (Code) *" },
                     { key: "type", label: "Product Type" },
                     { key: "category", label: "Category" },
                     { key: "brand", label: "Brand" },
                     { key: "unit", label: "Units" },
                     { key: "costPrice", label: "Cost Price" },
                     { key: "salePrice", label: "Sale Price" }
                   ].map((field) => (
                     <div key={field.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                       <strong style={{ fontSize: "13px", color: "#334155" }}>{field.label}</strong>
                       <select
                         style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "220px", fontSize: "13px", outline: "none" }}
                         value={columnMapping[field.key] || ""}
                         onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                       >
                         <option value="">-- Skip this field --</option>
                         {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                       </select>
                     </div>
                   ))}
                 </div>

                 <div style={{ display: "flex", gap: "12px" }}>
                   <button type="button" onClick={() => { setImportStep("UPLOAD"); setExcelHeaders([]); setExcelRows([]); }} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>Back</button>
                   <button type="button" onClick={processImport} style={{ flex: 2, padding: "12px", background: "#111827", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>Proceed & Import</button>
                 </div>
               </>
             )}

             {importStep === "IMPORTING" && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px", animation: "bounce 1s infinite" }}>⚙️</div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Importing Products...</h3>
                  <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "14px" }}>Please do not close this window.</p>
                </div>
             )}

           </div>
         </div>
      )}</div>
  );
}