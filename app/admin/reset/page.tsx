"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e4e8ef",
  borderRadius: "14px",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
};

const cardHeaderStyle: CSSProperties = {
  padding: "20px 24px",
  borderBottom: "1px solid #edf0f5",
  background: "#fbfcfe",
};

const fieldInputStyle: CSSProperties = {
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

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#344054",
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: "none",
    background: "#7b61a8",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 700,
    fontSize: "14px",
  };
}

function dangerButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: "none",
    background: "#b42318",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 700,
    fontSize: "14px",
  };
}

function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? { border: "1px solid #f1c0c0", background: "#fff7f7", color: "#b42318" }
      : { border: "1px solid #b7e4c7", background: "#f3fbf6", color: "#1e7b45" };

  return (
    <div style={{ ...styles, marginBottom: "18px", padding: "12px 15px", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
      {children}
    </div>
  );
}

export default function ResetDataPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Set / change password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Reset confirmation form
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [clearedSummary, setClearedSummary] = useState<Record<string, number> | null>(null);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/reset-password");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load status");
      }

      setConfigured(Boolean(data.configured));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSavePassword() {
    setError("");
    setSuccess("");

    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    if (configured && !currentPassword) {
      setError("Enter the current password to change it.");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          currentPassword: configured ? currentPassword : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to save password");
      }

      setSuccess(configured ? "Reset password changed." : "Reset password has been set.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setConfigured(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleReset() {
    setError("");
    setSuccess("");
    setClearedSummary(null);

    if (!resetPassword) {
      setError("Enter the reset password.");
      return;
    }

    if (confirmText !== "RESET") {
      setError('Type RESET in the confirmation box to proceed.');
      return;
    }

    setResetting(true);

    try {
      const response = await fetch("/api/admin/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to reset data");
      }

      setSuccess("All transactional data has been reset to zero.");
      setClearedSummary(data.cleared ?? null);
      setResetPassword("");
      setConfirmText("");
      setShowResetForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset data");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="dashboard" style={{ maxWidth: "720px", margin: "0 auto", paddingBottom: "40px" }}>
      <div className="dashboard-heading" style={{ marginBottom: "24px" }}>
        <p className="eyebrow" style={{ color: "#6b7280", fontWeight: 700, letterSpacing: "0.08em" }}>ADMIN</p>
        <h1>Reset Data</h1>
        <p className="dashboard-description">
          Wipe all sales, purchases, payments, journal entries, and stock movements back to zero.
          Products, customers, suppliers, warehouses, chart of accounts, and settings are kept.
        </p>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}

      {clearedSummary && (
        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          <div style={cardHeaderStyle}>
            <h2 style={{ margin: 0, color: "#172033", fontSize: "16px" }}>Rows cleared</h2>
          </div>
          <div style={{ padding: "16px 24px" }}>
            {Object.entries(clearedSummary).map(([table, count]) => (
              <div key={table} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "13px", color: "#344054" }}>
                <span>{table}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "30px", textAlign: "center", color: "#667085", fontSize: "13px" }}>Loading...</div>
      ) : (
        <>
          {/* -------------------------------------------------- */}
          {/* PASSWORD SETUP / CHANGE                              */}
          {/* -------------------------------------------------- */}
          <section style={{ ...cardStyle, marginBottom: "20px" }}>
            <div style={cardHeaderStyle}>
              <p style={{ margin: 0, color: "#7b61a8", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em" }}>SECURITY</p>
              <h2 style={{ margin: "5px 0 0", color: "#172033", fontSize: "18px" }}>
                {configured ? "Change Reset Password" : "Set Reset Password"}
              </h2>
              <p style={{ margin: "6px 0 0", color: "#667085", fontSize: "13px" }}>
                {configured
                  ? "You'll need the current password to set a new one."
                  : "No reset password is set yet. Set one before you can use the reset button below."}
              </p>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {configured && (
                <label style={labelStyle}>
                  <span>Current Password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={fieldInputStyle}
                  />
                </label>
              )}

              <label style={labelStyle}>
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={fieldInputStyle}
                  placeholder="At least 4 characters"
                />
              </label>

              <label style={labelStyle}>
                <span>Confirm New Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={fieldInputStyle}
                />
              </label>

              <div>
                <button
                  type="button"
                  disabled={savingPassword}
                  onClick={handleSavePassword}
                  style={primaryButtonStyle(savingPassword)}
                >
                  {savingPassword ? "Saving..." : configured ? "Change Password" : "Set Password"}
                </button>
              </div>
            </div>
          </section>

          {/* -------------------------------------------------- */}
          {/* DANGER ZONE                                         */}
          {/* -------------------------------------------------- */}
          <section style={{ ...cardStyle, border: "1px solid #f1c0c0" }}>
            <div style={{ ...cardHeaderStyle, background: "#fff7f7", borderBottom: "1px solid #f1c0c0" }}>
              <p style={{ margin: 0, color: "#b42318", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em" }}>DANGER ZONE</p>
              <h2 style={{ margin: "5px 0 0", color: "#172033", fontSize: "18px" }}>Reset All Transactions</h2>
              <p style={{ margin: "6px 0 0", color: "#667085", fontSize: "13px" }}>
                Permanently deletes every sales invoice, purchase bill, payment, journal entry, and stock movement,
                and zeroes out all stock quantities. This cannot be undone.
              </p>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {!configured ? (
                <p style={{ margin: 0, color: "#98a2b3", fontSize: "13px" }}>
                  Set a reset password above first.
                </p>
              ) : !showResetForm ? (
                <button
                  type="button"
                  onClick={() => setShowResetForm(true)}
                  style={dangerButtonStyle(false)}
                >
                  Reset All Data
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <label style={labelStyle}>
                    <span>Reset Password</span>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      style={fieldInputStyle}
                      autoFocus
                    />
                  </label>

                  <label style={labelStyle}>
                    <span>Type RESET to confirm</span>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      style={fieldInputStyle}
                      placeholder="RESET"
                    />
                  </label>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      disabled={resetting}
                      onClick={handleReset}
                      style={dangerButtonStyle(resetting)}
                    >
                      {resetting ? "Resetting..." : "Confirm Reset"}
                    </button>

                    <button
                      type="button"
                      disabled={resetting}
                      onClick={() => {
                        setShowResetForm(false);
                        setResetPassword("");
                        setConfirmText("");
                      }}
                      style={{ border: "1px solid #d8dee8", background: "#ffffff", color: "#344054", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "14px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}