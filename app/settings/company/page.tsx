"use client";

import { FormEvent, useEffect, useState } from "react";

type Company = {
  id?: string;
  name: string;
  legalName: string;
  ntn: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  currency: string;
};

const emptyCompany: Company = {
  name: "",
  legalName: "",
  ntn: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Pakistan",
  currency: "PKR",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    height: "44px",
    border: "1px solid #e5e9f0",
    borderRadius: "10px",
    padding: "0 13px",
    fontSize: "14px",
    color: "#172033",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: "92px",
    border: "1px solid #e5e9f0",
    borderRadius: "10px",
    padding: "12px 13px",
    fontSize: "14px",
    color: "#172033",
    background: "#ffffff",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#344054",
  };
}

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<Company>(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCompany() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/settings/company", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load company information.");
      }

      if (data.company) {
        setCompany({
          id: data.company.id,
          name: data.company.name ?? "",
          legalName: data.company.legalName ?? "",
          ntn: data.company.ntn ?? "",
          email: data.company.email ?? "",
          phone: data.company.phone ?? "",
          address: data.company.address ?? "",
          city: data.company.city ?? "",
          country: data.company.country ?? "Pakistan",
          currency: data.company.currency ?? "PKR",
        });
      } else {
        setCompany(emptyCompany);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load company information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompany();
  }, []);

  function updateField(field: keyof Company, value: string) {
    setCompany((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!company.name.trim()) {
      setError("Company name is required.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/settings/company", {
        method: company.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: company.name,
          legalName: company.legalName,
          ntn: company.ntn,
          email: company.email,
          phone: company.phone,
          address: company.address,
          city: company.city,
          country: company.country,
          currency: company.currency,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to save company information."
        );
      }

      if (data.company) {
        setCompany({
          id: data.company.id,
          name: data.company.name ?? "",
          legalName: data.company.legalName ?? "",
          ntn: data.company.ntn ?? "",
          email: data.company.email ?? "",
          phone: data.company.phone ?? "",
          address: data.company.address ?? "",
          city: data.company.city ?? "",
          country: data.company.country ?? "Pakistan",
          currency: data.company.currency ?? "PKR",
        });
      }

      setSuccess(
        data.message || "Company information saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save company information."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-heading">
          <p className="eyebrow">SETTINGS</p>
          <h1>Company</h1>
          <p className="dashboard-description">
            Manage your company's basic information and identity.
          </p>
        </div>

        <div
          className="dashboard-panel"
          style={{
            padding: "28px",
            color: "#667085",
            textAlign: "center",
          }}
        >
          Loading company information...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <p className="eyebrow">SETTINGS</p>
        <h1>Company</h1>
        <p className="dashboard-description">
          Manage your company's basic information and identity.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 15px",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b42318",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 15px",
            borderRadius: "10px",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#15803d",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section
          className="dashboard-panel"
          style={{
            marginBottom: "20px",
            padding: "24px",
          }}
        >
          <div
            style={{
              marginBottom: "22px",
              paddingBottom: "16px",
              borderBottom: "1px solid #e5e9f0",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                color: "#172033",
              }}
            >
              Business Information
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#667085",
              }}
            >
              Basic identity information used throughout the ERP.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            <div>
              <label style={labelStyle()}>
                Company Name <span style={{ color: "#dc2626" }}>*</span>
              </label>

              <input
                value={company.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                placeholder="Izan Bling"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>Legal Name</label>

              <input
                value={company.legalName}
                onChange={(event) =>
                  updateField("legalName", event.target.value)
                }
                placeholder="Izan Bling (Private) Limited"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>NTN</label>

              <input
                value={company.ntn}
                onChange={(event) =>
                  updateField("ntn", event.target.value)
                }
                placeholder="Enter NTN"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>Email</label>

              <input
                type="email"
                value={company.email}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                placeholder="company@example.com"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>Phone</label>

              <input
                value={company.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                placeholder="+92 300 0000000"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>City</label>

              <input
                value={company.city}
                onChange={(event) =>
                  updateField("city", event.target.value)
                }
                placeholder="Peshawar"
                style={inputStyle()}
              />
            </div>

            <div
              style={{
                gridColumn: "1 / -1",
              }}
            >
              <label style={labelStyle()}>Address</label>

              <textarea
                value={company.address}
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
                placeholder="Business address"
                style={textareaStyle()}
              />
            </div>
          </div>
        </section>

        <section
          className="dashboard-panel"
          style={{
            marginBottom: "20px",
            padding: "24px",
          }}
        >
          <div
            style={{
              marginBottom: "22px",
              paddingBottom: "16px",
              borderBottom: "1px solid #e5e9f0",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                color: "#172033",
              }}
            >
              Regional Settings
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#667085",
              }}
            >
              Default country and currency used by the ERP.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            <div>
              <label style={labelStyle()}>Country</label>

              <input
                value={company.country}
                onChange={(event) =>
                  updateField("country", event.target.value)
                }
                placeholder="Pakistan"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={labelStyle()}>Currency</label>

              <select
                value={company.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value)
                }
                style={inputStyle()}
              >
                <option value="PKR">PKR - Pakistani Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            paddingBottom: "30px",
          }}
        >
          <button
            type="button"
            onClick={loadCompany}
            disabled={saving}
            style={{
              height: "44px",
              padding: "0 18px",
              borderRadius: "10px",
              border: "1px solid #e5e9f0",
              background: "#ffffff",
              color: "#344054",
              fontWeight: 700,
              fontSize: "14px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              height: "44px",
              padding: "0 22px",
              borderRadius: "10px",
              border: "none",
              background: saving ? "#93b4f5" : "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(16, 24, 40, 0.08)",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
