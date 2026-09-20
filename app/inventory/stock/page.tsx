"use client";

import { useEffect, useMemo, useState } from "react";

type Lookup = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  reorderLevel: string | number;
  category: Lookup | null;
  brand: Lookup | null;
  unit: Lookup | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type StockRecord = {
  id: string;
  quantity: string | number;
  averageCost: string | number;
  product: Product;
  warehouse: Warehouse;
};

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

export default function StockPage() {
  const [stock, setStock] = useState<StockRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStock() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/stock");

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load stock");
      }

      setStock(data.stock || []);
      setWarehouses(data.warehouses || []);
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load stock"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  const filteredStock = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stock.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.product.name,
          item.product.sku,
          item.product.category?.name,
          item.product.brand?.name,
          item.warehouse.name,
          item.warehouse.code,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const matchesWarehouse =
        !warehouseFilter ||
        item.warehouse.id === warehouseFilter;

      const matchesProduct =
        !productFilter ||
        item.product.id === productFilter;

      return (
        matchesSearch &&
        matchesWarehouse &&
        matchesProduct
      );
    });
  }, [stock, search, warehouseFilter, productFilter]);

  const summary = useMemo(() => {
    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    filteredStock.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const averageCost = Number(item.averageCost || 0);

      totalQuantity += quantity;
      totalValue += quantity * averageCost;

      if (
        quantity <= Number(item.product.reorderLevel || 0)
      ) {
        lowStockCount += 1;
      }
    });

    return {
      totalQuantity,
      totalValue,
      lowStockCount,
      stockLines: filteredStock.length,
    };
  }, [filteredStock]);

  return (
    <div className="stock-page">
      <div className="stock-page-header">
        <div>
          <span className="stock-section-label">
            Inventory
          </span>

          <h1>Stock</h1>

          <p>
            Monitor inventory quantities, warehouse stock
            and inventory values.
          </p>
        </div>

        <button
          type="button"
          className="stock-refresh-button"
          onClick={loadStock}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="stock-error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="stock-summary-grid">
        <div className="stock-summary-card">
          <span>Total stock quantity</span>
          <strong>
            {formatQuantity(summary.totalQuantity)}
          </strong>
          <small>
            Across filtered stock lines
          </small>
        </div>

        <div className="stock-summary-card">
          <span>Inventory value</span>
          <strong>
            PKR {formatAmount(summary.totalValue)}
          </strong>
          <small>
            Based on average cost
          </small>
        </div>

        <div className="stock-summary-card">
          <span>Stock lines</span>
          <strong>{summary.stockLines}</strong>
          <small>
            Product / warehouse combinations
          </small>
        </div>

        <div className="stock-summary-card stock-warning-card">
          <span>Low stock</span>
          <strong>{summary.lowStockCount}</strong>
          <small>
            At or below reorder level
          </small>
        </div>
      </div>

      <section className="stock-list-panel">
        <div className="stock-list-toolbar">
          <div>
            <span className="stock-section-label">
              Inventory overview
            </span>

            <h2>Current Stock</h2>

            <p>
              {filteredStock.length} stock line
              {filteredStock.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <div className="stock-filters">
            <div className="stock-search-box">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search stock..."
              />
            </div>

            <select
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(event.target.value)
              }
            >
              <option value="">
                All warehouses
              </option>

              {warehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              value={productFilter}
              onChange={(event) =>
                setProductFilter(event.target.value)
              }
            >
              <option value="">
                All products
              </option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="stock-loading">
            <div className="stock-loading-spinner" />
            Loading stock...
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="stock-empty">
            <div className="stock-empty-icon">
              S
            </div>

            <h3>
              {stock.length === 0
                ? "No stock records yet"
                : "No matching stock"}
            </h3>

            <p>
              {stock.length === 0
                ? "Stock records will appear here when inventory is received or assigned to a warehouse."
                : "Try changing your search or filters."}
            </p>
          </div>
        ) : (
          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Average cost</th>
                  <th>Stock value</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredStock.map((item) => {
                  const quantity = Number(
                    item.quantity || 0
                  );

                  const averageCost = Number(
                    item.averageCost || 0
                  );

                  const stockValue =
                    quantity * averageCost;

                  const reorderLevel = Number(
                    item.product.reorderLevel || 0
                  );

                  const lowStock =
                    quantity <= reorderLevel;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="stock-product-cell">
                          <div className="stock-product-avatar">
                            {item.product.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {item.product.name}
                            </strong>

                            <small>
                              {item.product.sku}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="stock-warehouse-cell">
                          <strong>
                            {item.warehouse.name}
                          </strong>

                          <small>
                            {item.warehouse.code}
                          </small>
                        </div>
                      </td>

                      <td>
                        {item.product.category?.name ||
                          "—"}
                      </td>

                      <td>
                        <strong
                          className={
                            lowStock
                              ? "stock-quantity-low"
                              : "stock-quantity"
                          }
                        >
                          {formatQuantity(quantity)}
                        </strong>

                        {item.product.unit && (
                          <small className="stock-unit">
                            {item.product.unit.name}
                          </small>
                        )}
                      </td>

                      <td>
                        PKR{" "}
                        {formatAmount(averageCost)}
                      </td>

                      <td>
                        <strong>
                          PKR{" "}
                          {formatAmount(stockValue)}
                        </strong>
                      </td>

                      <td>
                        {lowStock ? (
                          <span className="stock-status low">
                            Low stock
                          </span>
                        ) : (
                          <span className="stock-status healthy">
                            In stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}