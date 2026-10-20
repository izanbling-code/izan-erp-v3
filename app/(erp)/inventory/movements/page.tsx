"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type Movement = {
  id: string;
  type: string;
  quantity: string | number;
  unitCost: string | number;
  totalCost: string | number;
  movementDate: string;
  notes: string | null;
  product: Product;
  sourceWarehouse: Warehouse | null;
  destinationWarehouse: Warehouse | null;
};

const movementTypes = [
  {
    value: "OPENING",
    label: "Opening Stock",
  },
  {
    value: "ADJUSTMENT_IN",
    label: "Adjustment In",
  },
  {
    value: "ADJUSTMENT_OUT",
    label: "Adjustment Out",
  },
  {
    value: "TRANSFER_IN",
    label: "Transfer In",
  },
  {
    value: "TRANSFER_OUT",
    label: "Transfer Out",
  },
];

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState("OPENING");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] =
    useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [movementResponse, productResponse, warehouseResponse] =
        await Promise.all([
          fetch("/api/inventory-movements"),
          fetch("/api/products"),
          fetch("/api/warehouses"),
        ]);

      const movementData = await movementResponse.json();
      const productData = await productResponse.json();
      const warehouseData = await warehouseResponse.json();

      if (!movementResponse.ok || !movementData.ok) {
        throw new Error(
          movementData.error || "Failed to load movements"
        );
      }

      if (!productResponse.ok || !productData.ok) {
        throw new Error(
          productData.error || "Failed to load products"
        );
      }

      if (!warehouseResponse.ok || !warehouseData.ok) {
        throw new Error(
          warehouseData.error || "Failed to load warehouses"
        );
      }

      setMovements(movementData.movements || []);
      setProducts(productData.products || []);
      setWarehouses(warehouseData.warehouses || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load inventory movements"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!productId) {
      setError("Please select a product.");
      return;
    }

    if (!warehouseId) {
      setError("Please select a warehouse.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (type === "TRANSFER_OUT" && !destinationWarehouseId) {
      setError("Please select a destination warehouse.");
      return;
    }

    if (
      type === "TRANSFER_OUT" &&
      destinationWarehouseId === warehouseId
    ) {
      setError(
        "Source and destination warehouses cannot be the same."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/inventory-movements",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            productId,
            sourceWarehouseId:
              type === "TRANSFER_OUT"
                ? warehouseId
                : null,
            destinationWarehouseId:
              type === "TRANSFER_OUT"
                ? destinationWarehouseId
                : warehouseId,
            quantity: Number(quantity),
            unitCost: Number(unitCost || 0),
            notes: notes.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to create movement"
        );
      }

      setProductId("");
      setWarehouseId("");
      setDestinationWarehouseId("");
      setQuantity("");
      setUnitCost("");
      setNotes("");

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create movement"
      );
    } finally {
      setSaving(false);
    }
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

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function movementLabel(value: string) {
    return (
      movementTypes.find((item) => item.value === value)
        ?.label || value
    );
  }

  return (
    <div className="inventory-movements-page">
      <div className="inventory-page-header">
        <div>
          <span className="inventory-section-label">
            Inventory
          </span>

          <h1>Stock Movements</h1>

          <p>
            Record opening stock, adjustments and warehouse
            transfers.
          </p>
        </div>
      </div>

      {error && (
        <div className="inventory-error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="inventory-movement-form-panel">
        <div className="inventory-form-header">
          <div>
            <span className="inventory-section-label">
              Inventory transaction
            </span>

            <h2>New Stock Movement</h2>

            <p>
              Create an inventory movement and update stock
              quantities.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="inventory-movement-grid">
            <label>
              Movement type
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value)
                }
              >
                {movementTypes.map((movement) => (
                  <option
                    key={movement.value}
                    value={movement.value}
                  >
                    {movement.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product
              <select
                value={productId}
                onChange={(event) =>
                  setProductId(event.target.value)
                }
                required
              >
                <option value="">
                  Select product
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.sku} — {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Warehouse
              <select
                value={warehouseId}
                onChange={(event) =>
                  setWarehouseId(event.target.value)
                }
                required
              >
                <option value="">
                  Select warehouse
                </option>

                {warehouses.map((warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            {type === "TRANSFER_OUT" && (
              <label>
                Destination warehouse
                <select
                  value={destinationWarehouseId}
                  onChange={(event) =>
                    setDestinationWarehouseId(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select destination
                  </option>

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.code} — {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Quantity
              <input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                placeholder="0.000"
                required
              />
            </label>

            <label>
              Unit cost
              <div className="inventory-input-prefix">
                <span>PKR</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(event) =>
                    setUnitCost(event.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
            </label>

            <label className="inventory-full-field">
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Optional notes..."
              />
            </label>
          </div>

          <div className="inventory-form-actions">
            <button
              type="submit"
              className="inventory-primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Record Movement"}
            </button>
          </div>
        </form>
      </section>

      <section className="inventory-movement-list-panel">
        <div className="inventory-list-header">
          <div>
            <span className="inventory-section-label">
              History
            </span>

            <h2>Recent Stock Movements</h2>

            <p>
              {movements.length} movement
              {movements.length === 1 ? "" : "s"} recorded
            </p>
          </div>
        </div>

        {loading ? (
          <div className="inventory-loading">
            Loading stock movements...
          </div>
        ) : movements.length === 0 ? (
          <div className="inventory-empty">
            <div className="inventory-empty-icon">
              M
            </div>

            <h3>No stock movements yet</h3>

            <p>
              Record an opening balance or inventory
              adjustment to begin tracking movements.
            </p>
          </div>
        ) : (
          <div className="inventory-table-wrapper">
            <table className="inventory-movement-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Movement</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      {formatDate(
                        movement.movementDate
                      )}
                    </td>

                    <td>
                      <span className="movement-type-badge">
                        {movementLabel(movement.type)}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {movement.product.name}
                      </strong>

                      <small>
                        {movement.product.sku}
                      </small>
                    </td>

                    <td>
                      {movement.sourceWarehouse?.name ||
                        movement.destinationWarehouse
                          ?.name ||
                        "—"}
                    </td>

                    <td>
                      {formatQuantity(
                        movement.quantity
                      )}
                    </td>

                    <td>
                      PKR{" "}
                      {formatAmount(
                        movement.unitCost
                      )}
                    </td>

                    <td>
                      <strong>
                        PKR{" "}
                        {formatAmount(
                          movement.totalCost
                        )}
                      </strong>
                    </td>

                    <td>
                      {movement.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}