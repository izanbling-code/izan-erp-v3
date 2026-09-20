"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku?: string | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type PurchaseLine = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  discount: string;
  tax: string;
  warehouseId: string;
  description: string;
  batchNumber: string;
};

function makeLine(): PurchaseLine {
  return {
    id: `${Date.now()}-${Math.random()}`,
    productId: "",
    quantity: "1",
    unitCost: "0",
    discount: "0",
    tax: "0",
    warehouseId: "",
    description: "",
    batchNumber: "",
  };
}

function formatAmount(value: number) {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d8dee8",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#172033",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#344054",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e4e8ef",
  borderRadius: "14px",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
};

export default function NewPurchaseBillPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [billDiscount, setBillDiscount] = useState("0");
  const [billTax, setBillTax] = useState("0");

  const [lines, setLines] = useState<PurchaseLine[]>([makeLine()]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [
          suppliersResponse,
          productsResponse,
          warehousesResponse,
        ] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/products"),
          fetch("/api/warehouses"),
        ]);

        const suppliersData = await suppliersResponse.json();
        const productsData = await productsResponse.json();
        const warehousesData = await warehousesResponse.json();

        if (!suppliersResponse.ok) {
          throw new Error(
            suppliersData.error || "Failed to load suppliers"
          );
        }

        if (!productsResponse.ok) {
          throw new Error(
            productsData.error || "Failed to load products"
          );
        }

        if (!warehousesResponse.ok) {
          throw new Error(
            warehousesData.error || "Failed to load warehouses"
          );
        }

        setSuppliers(
          suppliersData.suppliers ||
            suppliersData.data ||
            []
        );

        setProducts(
          productsData.products ||
            productsData.data ||
            []
        );

        setWarehouses(
          warehousesData.warehouses ||
            warehousesData.data ||
            []
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load purchase data"
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  function updateLine(
    lineId: string,
    field: keyof PurchaseLine,
    value: string
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  }

  function addLine() {
    setLines((current) => [...current, makeLine()]);
  }

  function removeLine(lineId: string) {
    setLines((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((line) => line.id !== lineId);
    });
  }

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const quantity = Number(line.quantity) || 0;
      const unitCost = Number(line.unitCost) || 0;

      return sum + quantity * unitCost;
    }, 0);
  }, [lines]);

  const lineDiscount = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + (Number(line.discount) || 0),
      0
    );
  }, [lines]);

  const lineTax = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + (Number(line.tax) || 0),
      0
    );
  }, [lines]);

  const totalDiscount =
    lineDiscount + (Number(billDiscount) || 0);

  const totalTax =
    lineTax + (Number(billTax) || 0);

  const total =
    subtotal - totalDiscount + totalTax;

  function validateForm() {
    if (!supplierId) {
      return "Please select a supplier.";
    }

    if (!billNo.trim()) {
      return "Please enter a bill number.";
    }

    if (!billDate) {
      return "Please select a bill date.";
    }

    if (lines.length === 0) {
      return "Add at least one purchase item.";
    }

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];

      if (!line.productId) {
        return `Please select a product for item ${index + 1}.`;
      }

      if (!line.warehouseId) {
        return `Please select a warehouse for item ${index + 1}.`;
      }

      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `Quantity must be greater than zero for item ${index + 1}.`;
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return `Unit cost cannot be negative for item ${index + 1}.`;
      }
    }

    return "";
  }

  async function saveBill(status: "DRAFT" | "POSTED") {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        supplierId,
        billNo: billNo.trim(),
        billDate,
        dueDate: dueDate || null,
        status,
        discount: Number(billDiscount) || 0,
        tax: Number(billTax) || 0,
        notes: notes.trim() || null,

        lines: lines.map((line) => ({
          productId: line.productId,
          batchNumber: line.batchNumber.trim() || null,
          quantity: Number(line.quantity) || 0,
          unitCost: Number(line.unitCost) || 0,
          discount: Number(line.discount) || 0,
          tax: Number(line.tax) || 0,
          warehouseId: line.warehouseId,
          description: line.description.trim() || null,
        })),
      };

      const response = await fetch(
        "/api/purchases/bills",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to save purchase bill"
        );
      }

      router.push("/purchases/bills");
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save purchase bill"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <div
        className="dashboard"
        style={{
          maxWidth: "1380px",
          margin: "0 auto",
        }}
      >
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">
              Purchases / Bills / New
            </p>

            <h1>New Purchase Bill</h1>

            <p className="dashboard-description">
              Loading suppliers, products and warehouses...
            </p>
          </div>
        </div>

        <section
          style={{
            ...sectionStyle,
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "#667085",
            }}
          >
            Loading purchase form...
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="dashboard"
      style={{
        maxWidth: "1380px",
        margin: "0 auto",
        paddingBottom: "40px",
      }}
    >
      <div
        className="dashboard-heading"
        style={{
          marginBottom: "24px",
        }}
      >
        <div>
          <p
            className="eyebrow"
            style={{
              color: "#6b7280",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            PURCHASES / BILLS / NEW
          </p>

          <h1
            style={{
              marginBottom: "6px",
              color: "#172033",
            }}
          >
            New Purchase Bill
          </h1>

          <p className="dashboard-description">
            Record a supplier purchase and receive the
            purchased products into inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/purchases/bills")}
          style={{
            border: "1px solid #d8dee8",
            background: "#ffffff",
            color: "#344054",
            padding: "10px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Back to Purchase Bills
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "13px 16px",
            borderRadius: "9px",
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#b42318",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <section style={sectionStyle}>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #edf0f5",
            background: "#fbfcfe",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#7b61a8",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.1em",
            }}
          >
            PURCHASE
          </p>

          <h2
            style={{
              margin: "5px 0 0",
              color: "#172033",
              fontSize: "19px",
            }}
          >
            Bill Details
          </h2>
        </div>

        <div
          style={{
            padding: "24px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          <label style={labelStyle}>
            <span>Supplier *</span>

            <select
              value={supplierId}
              onChange={(event) =>
                setSupplierId(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">
                Select supplier
              </option>

              {suppliers.map((supplier) => (
                <option
                  key={supplier.id}
                  value={supplier.id}
                >
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Supplier Bill No. *</span>

            <input
              type="text"
              value={billNo}
              onChange={(event) =>
                setBillNo(event.target.value)
              }
              placeholder="e.g. SUP-INV-1001"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Bill Date *</span>

            <input
              type="date"
              value={billDate}
              onChange={(event) =>
                setBillDate(event.target.value)
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Due Date</span>

            <input
              type="date"
              value={dueDate}
              onChange={(event) =>
                setDueDate(event.target.value)
              }
              style={inputStyle}
            />
          </label>

          <label
            style={{
              ...labelStyle,
              gridColumn: "1 / -1",
            }}
          >
            <span>Notes</span>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Optional notes"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>
        </div>
      </section>

      <section
        style={{
          ...sectionStyle,
          marginTop: "20px",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #edf0f5",
            background: "#fbfcfe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#7b61a8",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              INVENTORY
            </p>

            <h2
              style={{
                margin: "5px 0 0",
                color: "#172033",
                fontSize: "19px",
              }}
            >
              Purchase Items
            </h2>
          </div>

          <button
            type="button"
            onClick={addLine}
            style={{
              border: "none",
              background: "#7b61a8",
              color: "#ffffff",
              padding: "10px 15px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: "0 3px 8px rgba(123, 97, 168, 0.22)",
            }}
          >
            + Add Item
          </button>
        </div>

        <div
          style={{
            overflowX: "auto",
            padding: "0 24px",
          }}
        >
          <table className="erp-data-table">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #e4e8ef",
                }}
              >
                {[
                  ["Product", "220px"],
                  ["Batch No.", "130px"],
                  ["Quantity", "100px"],
                  ["Unit Cost", "130px"],
                  ["Discount", "120px"],
                  ["Tax", "110px"],
                  ["Warehouse", "180px"],
                  ["Total", "140px"],
                  ["Action", "90px"],
                ].map(([heading, width]) => (
                  <th
                    key={heading}
                    style={{
                      minWidth: width,
                      padding: "13px 8px",
                      textAlign: "left",
                      color: "#667085",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {lines.map((line) => {
                const quantity =
                  Number(line.quantity) || 0;

                const unitCost =
                  Number(line.unitCost) || 0;

                const discount =
                  Number(line.discount) || 0;

                const tax =
                  Number(line.tax) || 0;

                const lineTotal =
                  quantity * unitCost -
                  discount +
                  tax;

                return (
                  <tr
                    key={line.id}
                    style={{
                      borderBottom: "1px solid #edf0f5",
                    }}
                  >
                    <td >
                      <select
                        value={line.productId}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "productId",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="">
                          Select product
                        </option>

                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                          >
                            {product.name}
                            {product.sku
                              ? ` (${product.sku})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td >
                      <input
                        type="text"
                        value={line.batchNumber}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "batchNumber",
                            event.target.value
                          )
                        }
                        placeholder="Auto"
                        style={inputStyle}
                      />
                    </td>

                    <td >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "quantity",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "unitCost",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "discount",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.tax}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "tax",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      />
                    </td>

                    <td >
                      <select
                        value={line.warehouseId}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "warehouseId",
                            event.target.value
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="">
                          Select warehouse
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
                    </td>

                    <td
                      style={{
                        padding: "12px 8px",
                        whiteSpace: "nowrap",
                        color: "#172033",
                      }}
                    >
                      <strong>
                        PKR {formatAmount(lineTotal)}
                      </strong>
                    </td>

                    <td >
                      <button
                        type="button"
                        onClick={() =>
                          removeLine(line.id)
                        }
                        disabled={lines.length === 1}
                        style={{
                          border: "none",
                          background: "transparent",
                          color:
                            lines.length === 1
                              ? "#98a2b3"
                              : "#d92d20",
                          cursor:
                            lines.length === 1
                              ? "default"
                              : "pointer",
                          fontWeight: 700,
                          padding: "5px",
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: "20px 24px 24px",
            borderTop: "1px solid #edf0f5",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "12px",
            }}
          >
            ITEM DESCRIPTIONS
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {lines.map((line, index) => (
              <label
                key={line.id}
                style={labelStyle}
              >
                <span>
                  Item {index + 1} Description
                </span>

                <input
                  type="text"
                  value={line.description}
                  onChange={(event) =>
                    updateLine(
                      line.id,
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="Optional item description"
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          ...sectionStyle,
          marginTop: "20px",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #edf0f5",
            background: "#fbfcfe",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#7b61a8",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.1em",
            }}
          >
            AMOUNT
          </p>

          <h2
            style={{
              margin: "5px 0 0",
              color: "#172033",
              fontSize: "19px",
            }}
          >
            Bill Totals
          </h2>
        </div>

        <div
          style={{
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "20px",
              maxWidth: "700px",
            }}
          >
            <label style={labelStyle}>
              <span>Bill Discount</span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={billDiscount}
                onChange={(event) =>
                  setBillDiscount(event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>Bill Tax</span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={billTax}
                onChange={(event) =>
                  setBillTax(event.target.value)
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div
            style={{
              marginTop: "28px",
              marginLeft: "auto",
              maxWidth: "430px",
              border: "1px solid #e4e8ef",
              borderRadius: "12px",
              padding: "18px 20px",
              background: "#fbfcfe",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                color: "#475467",
              }}
            >
              <span>Subtotal</span>

              <strong>
                PKR {formatAmount(subtotal)}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                color: "#475467",
              }}
            >
              <span>Discount</span>

              <strong style={{ color: "#b42318" }}>
                - PKR {formatAmount(totalDiscount)}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                color: "#475467",
              }}
            >
              <span>Tax</span>

              <strong>
                + PKR {formatAmount(totalTax)}
              </strong>
            </div>

            <div
              style={{
                borderTop: "1px solid #d8dee8",
                marginTop: "10px",
                paddingTop: "15px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong
                style={{
                  fontSize: "16px",
                  color: "#172033",
                }}
              >
                Grand Total
              </strong>

              <strong
                style={{
                  fontSize: "21px",
                  color: "#7b61a8",
                }}
              >
                PKR {formatAmount(total)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            router.push("/purchases/bills")
          }
          style={{
            padding: "11px 18px",
            border: "1px solid #d8dee8",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#344054",
            cursor: saving
              ? "default"
              : "pointer",
            fontWeight: 600,
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveBill("DRAFT")}
          style={{
            padding: "11px 18px",
            border: "1px solid #7b61a8",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#7b61a8",
            cursor: saving
              ? "default"
              : "pointer",
            fontWeight: 700,
          }}
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => saveBill("POSTED")}
          style={{
            padding: "11px 20px",
            border: "1px solid #7b61a8",
            borderRadius: "8px",
            background: "#7b61a8",
            color: "#ffffff",
            cursor: saving
              ? "default"
              : "pointer",
            fontWeight: 700,
            boxShadow:
              "0 3px 8px rgba(123, 97, 168, 0.22)",
          }}
        >
          {saving ? "Saving..." : "Save & Post"}
        </button>
      </div>
    </div>
  );
}
