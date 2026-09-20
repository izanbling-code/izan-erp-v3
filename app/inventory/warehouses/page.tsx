"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
};

type WarehouseForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  isActive: boolean;
};

const emptyForm: WarehouseForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  isActive: true,
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<WarehouseForm>(emptyForm);

  async function loadWarehouses() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/warehouses");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to load warehouses"
        );
      }

      setWarehouses(data.warehouses);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load warehouses"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  const filteredWarehouses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return warehouses;
    }

    return warehouses.filter((warehouse) =>
      [
        warehouse.name,
        warehouse.code,
        warehouse.address,
        warehouse.city,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [warehouses, search]);

  function updateField(
    field: keyof WarehouseForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Warehouse name is required.");
      return;
    }

    if (!form.code.trim()) {
      setError("Warehouse code is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/warehouses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          address: form.address.trim(),
          city: form.city.trim(),
          isActive: form.isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to create warehouse"
        );
      }

      setForm(emptyForm);
      setShowForm(false);

      await loadWarehouses();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create warehouse"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <div>
          <div className="dashboard-eyebrow">
            Inventory
          </div>

          <h1>Warehouses</h1>

          <p className="dashboard-description">
            Manage warehouses and storage locations.
          </p>
        </div>

        <button
          type="button"
          className="customer-primary-button"
          onClick={() => {
            setError("");
            setForm(emptyForm);
            setShowForm(true);
          }}
        >
          + New Warehouse
        </button>
      </div>

      {error && (
        <div className="customer-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="dashboard-panel customer-form-panel">
          <div className="panel-heading">
            <div>
              <h2>New warehouse</h2>

              <p className="customer-form-subtitle">
                Add a warehouse or storage location.
              </p>
            </div>

            <button
              type="button"
              className="customer-secondary-button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="customer-form-grid">
              <label>
                Warehouse name *
                <input
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Main Warehouse"
                  required
                />
              </label>

              <label>
                Warehouse code *
                <input
                  value={form.code}
                  onChange={(event) =>
                    updateField(
                      "code",
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="e.g. MAIN"
                  required
                />
              </label>

              <label>
                City
                <input
                  value={form.city}
                  onChange={(event) =>
                    updateField(
                      "city",
                      event.target.value
                    )
                  }
                  placeholder="Peshawar"
                />
              </label>

              <label>
                Status
                <select
                  value={
                    form.isActive
                      ? "ACTIVE"
                      : "INACTIVE"
                  }
                  onChange={(event) =>
                    updateField(
                      "isActive",
                      event.target.value === "ACTIVE"
                    )
                  }
                >
                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>
              </label>

              <label className="customer-form-full">
                Address
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    updateField(
                      "address",
                      event.target.value
                    )
                  }
                  placeholder="Warehouse address"
                  rows={3}
                />
              </label>
            </div>

            <div className="customer-form-actions">
              <button
                type="button"
                className="customer-secondary-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="customer-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Warehouse"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="dashboard-panel">
        <div className="panel-heading customer-list-heading">
          <div>
            <h2>Warehouse list</h2>

            <p className="customer-count">
              {warehouses.length} warehouse
              {warehouses.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          <input
            className="customer-search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search warehouses..."
          />
        </div>

        {loading ? (
          <div className="customer-loading">
            Loading warehouses...
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              WH
            </div>

            <h3>
              {warehouses.length === 0
                ? "No warehouses yet"
                : "No matching warehouses"}
            </h3>

            <p>
              {warehouses.length === 0
                ? "Create your first warehouse to start managing inventory locations."
                : "Try a different warehouse name, code or city."}
            </p>

            {warehouses.length === 0 && (
              <button
                type="button"
                className="customer-primary-button"
                onClick={() => {
                  setError("");
                  setForm(emptyForm);
                  setShowForm(true);
                }}
              >
                + Add first warehouse
              </button>
            )}
          </div>
        ) : (
          <div className="customer-table-wrapper">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredWarehouses.map(
                  (warehouse) => (
                    <tr key={warehouse.id}>
                      <td>
                        <strong>
                          {warehouse.name}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {warehouse.code}
                        </strong>
                      </td>

                      <td>
                        {warehouse.city || "—"}
                      </td>

                      <td>
                        {warehouse.address || "—"}
                      </td>

                      <td>
                        <span
                          className={`customer-status ${
                            warehouse.isActive
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {warehouse.isActive
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}