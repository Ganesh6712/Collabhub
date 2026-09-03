"use client";

import { useCallback, useEffect, useState } from "react";

type AnyUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
};

type AnyMember = {
  id: string;
  role: string;
  user?: { id: string; email: string; name?: string | null };
  email?: string;
  name?: string;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};

/**
 * Admin-only control panel.
 * It verifies the caller is an ADMIN by calling /api/admin/members.
 * Non-admins get a clean message instead of a broken panel.
 */
export default function AdminPanel({
  workspaceId,
  accessToken,
  onChange,
}: {
  workspaceId: string;
  accessToken: string;
  onChange?: () => void;
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "error">(
    "loading"
  );
  const [members, setMembers] = useState<AnyMember[]>([]);
  const [allUsers, setAllUsers] = useState<AnyUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("EMPLOYEE");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  // ------------------------------------------------ load data
  const load = useCallback(async () => {
    try {
      const [memberRes, userRes] = await Promise.all([
        fetch(`${API}/api/admin/members?workspaceId=${workspaceId}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch(`${API}/api/users`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);

      if (memberRes.status === 403) {
        setStatus("denied");
        return;
      }
      if (!memberRes.ok) {
        setStatus("error");
        setMessage("Could not load members. Is the API container rebuilt?");
        return;
      }

      const memberData = await memberRes.json();
      setMembers(Array.isArray(memberData.members) ? memberData.members : []);

      if (userRes.ok) {
        const userData = await userRes.json();
        setAllUsers(Array.isArray(userData.users) ? userData.users : []);
      }

      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setMessage("Network error talking to the API.");
    }
  }, [API, accessToken, authHeaders, workspaceId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // auto-refresh every 5s
    return () => clearInterval(interval);
  }, [load]);

  const notify = () => {
    if (onChange) onChange();
  };

  // ------------------------------------------------ actions
  const updateRole = async (memberId: string, newRole: string) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(
        `${API}/api/admin/members/${memberId}?workspaceId=${workspaceId}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ role: newRole }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(`Role updated to ${ROLE_LABEL[newRole] || newRole}.`);
        await load();
        notify();
      } else {
        setMessage(data.error || "Failed to update role.");
      }
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(
        `${API}/api/admin/members/${memberId}?workspaceId=${workspaceId}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Member removed.");
        await load();
        notify();
      } else {
        setMessage(data.error || "Failed to remove member.");
      }
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setMessage("Please pick a user from the list.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(
        `${API}/api/admin/members?workspaceId=${workspaceId}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Member added.");
        setSelectedUserId("");
        setSelectedRole("EMPLOYEE");
        await load();
        notify();
      } else {
        setMessage(data.error || "Failed to add member.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------ guards
  if (status === "loading") {
    return <div className="card">Loading admin data...</div>;
  }

  if (status === "denied") {
    return (
      <div className="card">
        <h2 className="section-title">Admin Panel</h2>
        <p className="muted-text">
          You need the <strong>Admin</strong> role in this workspace to open
          this panel. Your current role does not allow it.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card">
        <h2 className="section-title">Admin Panel</h2>
        <p className="muted-text">{message}</p>
        <button className="btn-secondary mt-3" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  const memberIds = new Set(
    members.map((m) => m.user?.id || m.email).filter(Boolean)
  );
  const nonMembers = allUsers.filter(
    (u) => !memberIds.has(u.id) && !memberIds.has(u.email)
  );

  const counts = {
    ADMIN: members.filter((m) => m.role === "ADMIN").length,
    TEAM_LEAD: members.filter((m) => m.role === "TEAM_LEAD").length,
    EMPLOYEE: members.filter((m) => m.role === "EMPLOYEE").length,
  };

  return (
    <div className="mt-6 space-y-6">
      {message && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {message}
        </div>
      )}

      {/* ---------- role counts ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["ADMIN", "TEAM_LEAD", "EMPLOYEE"] as const).map((r) => (
          <div key={r} className="card">
            <div className="muted-text text-xs uppercase tracking-wide">
              {ROLE_LABEL[r]}s
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">
              {counts[r]}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- members ---------- */}
      <div className="card">
        <h2 className="section-title mb-4">Workspace Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-900">
                    {member.user?.name || member.name || "-"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {member.user?.email || member.email}
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="TEAM_LEAD">Team Lead</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={busy}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- add member ---------- */}
      <div className="card">
        <h2 className="section-title mb-4">Add Member</h2>
        <form
          onSubmit={addMember}
          className="flex flex-col gap-4 md:flex-row"
        >
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="input flex-1"
            required
          >
            <option value="">Select a registered user</option>
            {nonMembers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email} — {user.email} ({user.id.slice(0, 8)})
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="input w-full md:w-48"
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="TEAM_LEAD">Team Lead</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary whitespace-nowrap disabled:opacity-50"
          >
            Add Member
          </button>
        </form>
        <p className="muted-text mt-3 text-xs">
          The user must register at /register first, then they appear in this
          list automatically (refreshes every 5 seconds).
        </p>
      </div>

      {/* ---------- all users ---------- */}
      <div className="card">
        <h2 className="section-title mb-4">All Registered Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">User ID</th>
                <th className="py-3">In this workspace</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-900">
                    {user.name || "-"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                    {user.id}
                  </td>
                  <td className="py-3 text-slate-500">
                    {memberIds.has(user.id) ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
