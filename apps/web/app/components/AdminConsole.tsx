"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Member = {
  id: string;
  role: string;
  createdAt?: string;
  user?: { id: string; email: string; name?: string | null };
  projects?: { id: string; name: string }[];
};

type RegUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
};

type Role = "ADMIN" | "TEAM_LEAD" | "EMPLOYEE";
type Filter = "all" | Role;

const ROLES: Role[] = ["ADMIN", "TEAM_LEAD", "EMPLOYEE"];

const LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};

const PLURAL: Record<Role, string> = {
  ADMIN: "Admins",
  TEAM_LEAD: "Team Leads",
  EMPLOYEE: "Employees",
};

const BADGE: Record<Role, string> = {
  ADMIN: "bg-violet-100 text-violet-700",
  TEAM_LEAD: "bg-sky-100 text-sky-700",
  EMPLOYEE: "bg-emerald-100 text-emerald-700",
};

const POLL_MS = 2000; // members appear within ~2 seconds

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */

function initialsOf(name?: string | null, email?: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/*
 * Members-only admin console. Opens directly into the members list.
 * The role chips (All / Admins / Team Leads / Employees) filter the
 * table IN PLACE — the add-member and all-users sections always stay
 * visible. No separate overview page, no separate role page.
 */
export default function AdminConsole({
  workspaceId,
  accessToken,
}: {
  workspaceId: string;
  accessToken: string;
}) {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<RegUser[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");

  const [notice, setNotice] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<Role>("EMPLOYEE");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  /* -------------------------------------------------- load (2s poll) */
  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/api/admin/console?workspaceId=${workspaceId}`,
        { headers, cache: "no-store" }
      );

      if (res.status === 403) {
        setStatus("denied");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = await res.json();
      setMembers(Array.isArray(data.members) ? data.members : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setWorkspaceName(data.workspace?.name || "");
      setStatus("ok");
    } catch {
      setStatus((s) => (s === "ok" ? s : "error"));
    }
  }, [API, accessToken, headers, workspaceId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const flash = (kind: "ok" | "bad", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 3500);
  };

  /* -------------------------------------------------- actions */
  const changeRole = async (member: Member, role: string) => {
    setSavingId(member.id);
    try {
      const res = await fetch(
        `${API}/api/admin/members/${member.id}?workspaceId=${workspaceId}`,
        { method: "PATCH", headers, body: JSON.stringify({ role }) }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role } : m))
        );
        flash("ok", `${member.user?.name || member.user?.email} is now ${LABEL[role as Role]}.`);
      } else {
        flash("bad", data.error || "Could not change the role.");
      }
    } finally {
      setSavingId("");
    }
  };

  const removeMember = async (member: Member) => {
    const who = member.user?.name || member.user?.email || "this member";
    if (!confirm(`Remove ${who} from CollabHub?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/admin/members/${member.id}?workspaceId=${workspaceId}`,
        { method: "DELETE", headers }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        flash("ok", `${who} removed.`);
      } else {
        flash("bad", data.error || "Could not remove the member.");
      }
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserId) {
      flash("bad", "Pick a user from the list first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/api/admin/members?workspaceId=${workspaceId}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: addUserId, role: addRole }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddUserId("");
        setAddRole("EMPLOYEE");
        flash("ok", "Member added.");
        await load();
      } else {
        flash("bad", data.error || "Could not add the member.");
      }
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------- derived */
  const counts = useMemo(
    () => ({
      ADMIN: members.filter((m) => m.role === "ADMIN").length,
      TEAM_LEAD: members.filter((m) => m.role === "TEAM_LEAD").length,
      EMPLOYEE: members.filter((m) => m.role === "EMPLOYEE").length,
    }),
    [members]
  );

  const memberUserIds = useMemo(
    () => new Set(members.map((m) => m.user?.id).filter(Boolean) as string[]),
    [members]
  );

  const availableUsers = useMemo(
    () => users.filter((u) => !memberUserIds.has(u.id)),
    [users, memberUserIds]
  );

  // the chips filter the table in place — everything else stays visible
  const filteredMembers =
    filter === "all" ? members : members.filter((m) => m.role === filter);

  const tableTitle = filter === "all" ? "All Members" : PLURAL[filter];
  const tableSubtitle =
    filter === "all"
      ? "Change any role from the dropdown - it saves to the database instantly."
      : `Everyone with the ${LABEL[filter]} role. Switch filters above anytime.`;

  /* -------------------------------------------------- guards */
  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
        Loading the admin console...
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <h2 className="text-lg font-semibold text-amber-900">Admin access only</h2>
        <p className="mt-2 text-sm text-amber-800">
          Your role in this workspace is not <strong>Admin</strong>, so this
          console is closed to you.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h2 className="text-lg font-semibold text-red-900">Could not load the console</h2>
        <p className="mt-2 text-sm text-red-800">
          The API did not answer. Rebuild the containers with{" "}
          <code className="rounded bg-white px-1">docker compose build --no-cache web api</code>.
        </p>
        <button
          onClick={load}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  /* -------------------------------------------------- render */
  return (
    <div className="space-y-6">
      {/* notice */}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {workspaceName && (
        <div className="flex justify-end">
          <span className="text-xs text-slate-400">
            {workspaceName} · updates every 2s
          </span>
        </div>
      )}

      {/* filter chips — filter the table below in place */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            filter === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All ({members.length})
        </button>
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === r
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {PLURAL[r]} ({counts[r]})
          </button>
        ))}
      </div>

      {/* member table (filtered in place) */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{tableTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{tableSubtitle}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3">Team (projects)</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {initialsOf(m.user?.name, m.user?.email)}
                      </div>
                      <div className="font-medium text-slate-900">
                        {m.user?.name || "Unnamed"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{m.user?.email}</td>
                                    <td className="px-6 py-4 text-slate-500">{timeAgo(m.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {m.projects && m.projects.length > 0 ? (
                        m.projects.map((p) => (
                          <span
                            key={p.id}
                            className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                          >
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        disabled={savingId === m.id || busy}
                        onChange={(e) => changeRole(m, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {LABEL[r]}
                          </option>
                        ))}
                      </select>
                      {savingId === m.id && (
                        <span className="text-xs text-slate-400">saving...</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => removeMember(m)}
                      disabled={busy}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    Nobody here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* add member */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Add a member</h3>
        <p className="mt-1 text-sm text-slate-500">
          They must register at /register first. New registrations appear here
          on their own within a couple of seconds.
        </p>
        <form onSubmit={addMember} className="mt-4 flex flex-col gap-3 md:flex-row">
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="">Select a registered user</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} — {u.email} ({u.id.slice(0, 8)})
              </option>
            ))}
          </select>
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as Role)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none md:w-48"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {LABEL[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Member
          </button>
        </form>
        {availableUsers.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Every registered user is already a member.
          </p>
        )}
      </div>

      {/* everyone registered */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-900">
            All registered users ({users.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">User ID</th>
                <th className="px-6 py-3">Member?</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-6 py-3 font-medium text-slate-900">{u.name || "-"}</td>
                  <td className="px-6 py-3 text-slate-600">{u.email}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{u.id}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {memberUserIds.has(u.id) ? "Yes" : "No"}
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