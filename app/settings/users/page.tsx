"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  roleId: string | null;
  role: Role | null;
  createdAt: string;
  updatedAt: string;
};

type UserForm = {
  id?: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  status: "ACTIVE",
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

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#344054",
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/settings/users", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load users.");
      }
      setUsers(Array.isArray(data.users) ? data.users : []);

      try {
        const rolesRes = await fetch("/api/roles", { cache: "no-store" });
        const rolesData = await rolesRes.json();
        if (rolesRes.ok && rolesData.success) {
          setRoles(rolesData.roles);
        }
      } catch (roleErr) {
        console.error("Failed to load roles", roleErr);
      }

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.role?.name ?? "").toLowerCase().includes(query)
      );
    });
  }, [users, search]);

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);

    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      roleId: user.roleId ?? "",
      status: user.status,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
  }

  function updateField<K extends keyof UserForm>(
    field: K,
    value: UserForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("User name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (!editingUser && form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/settings/users", {
        method: editingUser ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          email: form.email,
          password: form.password,
          roleId: form.roleId || null,
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            (editingUser
              ? "Failed to update user."
              : "Failed to create user.")
        );
      }

      setSuccess(
        data.message ||
          (editingUser
            ? "User updated successfully."
            : "User created successfully.")
      );

      setShowForm(false);
      setEditingUser(null);
      setForm(emptyForm);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save user."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: User) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch("/api/settings/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          status:
            user.status === "ACTIVE"
              ? "INACTIVE"
              : "ACTIVE",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to update user status."
        );
      }

      setSuccess(
        user.status === "ACTIVE"
          ? "User deactivated successfully."
          : "User activated successfully."
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user status."
      );
    }
  }

  async function deleteUser(user: User) {
    const confirmed = window.confirm(
      `Delete user "${user.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(user.id);
      setError("");
      setSuccess("");

      const response = await fetch("/api/settings/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to delete user."
        );
      }

      setSuccess(
        data.message || "User deleted successfully."
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete user."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-heading">
          <p className="eyebrow">SETTINGS</p>
          <h1>Users</h1>
          <p className="dashboard-description">
            Manage users who can access your ERP.
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
          Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div
        className="dashboard-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "20px",
        }}
      >
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Users</h1>
          <p className="dashboard-description">
            Manage users who can access your ERP.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          style={{
            height: "44px",
            padding: "0 20px",
            borderRadius: "10px",
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.08)",
            whiteSpace: "nowrap",
          }}
        >
          + Add User
        </button>
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

      {showForm && (
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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "17px",
                  color: "#172033",
                }}
              >
                {editingUser ? "Edit User" : "Add User"}
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#667085",
                }}
              >
                {editingUser
                  ? "Update this user's account and access settings."
                  : "Create a new ERP user account."}
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              style={{
                border: "none",
                background: "transparent",
                color: "#667085",
                fontSize: "22px",
                cursor: saving ? "not-allowed" : "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "20px",
              }}
            >
              <div>
                <label style={labelStyle()}>
                  Full Name{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  placeholder="John Doe"
                  style={inputStyle()}
                />
              </div>

              <div>
                <label style={labelStyle()}>
                  Email{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  placeholder="user@example.com"
                  style={inputStyle()}
                />
              </div>

              <div>
                <label style={labelStyle()}>
                  {editingUser
                    ? "New Password"
                    : "Password"}{" "}
                  {!editingUser && (
                    <span style={{ color: "#dc2626" }}>*</span>
                  )}
                </label>

                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateField(
                      "password",
                      event.target.value
                    )
                  }
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current password"
                      : "Minimum 6 characters"
                  }
                  style={inputStyle()}
                />
              </div>

              <div>
                <label style={labelStyle()}>Role</label>

                <select
                  value={form.roleId}
                  onChange={(event) =>
                    updateField(
                      "roleId",
                      event.target.value
                    )
                  }
                  style={inputStyle()}
                >
                  <option value="">No role assigned</option>

                  {roles.map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                    >
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle()}>Status</label>

                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value as
                        | "ACTIVE"
                        | "INACTIVE"
                    )
                  }
                  style={inputStyle()}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <button
                type="button"
                onClick={closeForm}
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
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
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
                  background: saving
                    ? "#93b4f5"
                    : "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : editingUser
                    ? "Update User"
                    : "Create User"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section
        className="dashboard-panel"
        style={{
          padding: "0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid #e5e9f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                color: "#172033",
              }}
            >
              System Users
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#667085",
              }}
            >
              {users.length}{" "}
              {users.length === 1 ? "user" : "users"}{" "}
              configured.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search users..."
            style={{
              ...inputStyle(),
              width: "260px",
            }}
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div
            style={{
              padding: "50px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                marginBottom: "10px",
              }}
            >
              👤
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                color: "#172033",
              }}
            >
              {search
                ? "No users found"
                : "No users yet"}
            </h3>

            <p
              style={{
                margin: "7px 0 18px",
                fontSize: "13px",
                color: "#667085",
              }}
            >
              {search
                ? "Try a different search."
                : "Create your first ERP user to get started."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={openCreate}
                style={{
                  height: "40px",
                  padding: "0 17px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                + Add User
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              overflowX: "auto",
            }}
          >
            <table className="erp-data-table">
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                    borderBottom:
                      "1px solid #e5e9f0",
                  }}
                >
                  {[
                    "User",
                    "Role",
                    "Status",
                    "Created",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "13px 18px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#667085",
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom:
                        "1px solid #eef1f5",
                    }}
                  >
                    <td
                      style={{
                        padding: "16px 18px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "11px",
                        }}
                      >
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            background:
                              "#eff6ff",
                            color: "#2563eb",
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize: "14px",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {user.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#172033",
                            }}
                          >
                            {user.name}
                          </div>

                          <div
                            style={{
                              marginTop: "3px",
                              fontSize: "12px",
                              color: "#667085",
                            }}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "16px 18px",
                        fontSize: "13px",
                        color: "#344054",
                      }}
                    >
                      {user.role?.name ?? (
                        <span
                          style={{
                            color: "#98a2b3",
                          }}
                        >
                          No role
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "16px 18px",
                      }}
                    >
                      <span
                        style={{
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          padding:
                            "5px 9px",
                          borderRadius:
                            "999px",
                          background:
                            user.status ===
                            "ACTIVE"
                              ? "#f0fdf4"
                              : "#fef2f2",
                          color:
                            user.status ===
                            "ACTIVE"
                              ? "#15803d"
                              : "#b42318",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        {user.status ===
                        "ACTIVE"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "16px 18px",
                        fontSize: "13px",
                        color: "#667085",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatDate(
                        user.createdAt
                      )}
                    </td>

                    <td
                      style={{
                        padding: "16px 18px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: "7px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(user)
                          }
                          style={{
                            height: "34px",
                            padding:
                              "0 11px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #e5e9f0",
                            background:
                              "#ffffff",
                            color:
                              "#344054",
                            fontSize:
                              "12px",
                            fontWeight: 700,
                            cursor:
                              "pointer",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleStatus(
                              user
                            )
                          }
                          style={{
                            height: "34px",
                            padding:
                              "0 11px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #e5e9f0",
                            background:
                              "#ffffff",
                            color:
                              user.status ===
                              "ACTIVE"
                                ? "#b54708"
                                : "#15803d",
                            fontSize:
                              "12px",
                            fontWeight: 700,
                            cursor:
                              "pointer",
                          }}
                        >
                          {user.status ===
                          "ACTIVE"
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteUser(
                              user
                            )
                          }
                          disabled={
                            deletingId ===
                            user.id
                          }
                          style={{
                            height: "34px",
                            padding:
                              "0 11px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #fecaca",
                            background:
                              "#fffafa",
                            color:
                              "#dc2626",
                            fontSize:
                              "12px",
                            fontWeight: 700,
                            cursor:
                              deletingId ===
                              user.id
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {deletingId ===
                          user.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        style={{
          paddingBottom: "30px",
        }}
      />
    </div>
  );
}