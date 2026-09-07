"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { io } from "socket.io-client";
import LogoutButton from "../../components/LogoutButton";
import AdminConsole from "../../components/AdminConsole";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  TEAM_LEAD: "bg-blue-100 text-blue-700",
  EMPLOYEE: "bg-emerald-100 text-emerald-700",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  "in-progress": "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

export default function WorkspaceDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberProjectIds, setMemberProjectIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // my project invites (Accept / Reject requests)
  const [myInvites, setMyInvites] = useState<any[]>([]);
  const [inviteBusy, setInviteBusy] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectError, setProjectError] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);

  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState<any>(null);
  const [chatChannel, setChatChannel] = useState<string>("general");
  const [taskMessages, setTaskMessages] = useState<any[]>([]);
  const chatChannelRef = useRef<string>("general");
  chatChannelRef.current = chatChannel;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  const API = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (!workspaceId) return;
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") {
      fetchOverview();
      connectSocket();
      fetchFiles();
    }
  }, [status, workspaceId]);

  // which projects am I an invited member of (non-admin privacy)
  useEffect(() => {
    if (projects.length === 0) {
      setMemberProjectIds([]);
      return;
    }
    const myId = session?.user?.id;
    Promise.all(
      projects.map((p) =>
        fetch(`${API}/api/projects/${p.id}/members`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        })
          .then((r) => (r.ok ? r.json() : { members: [] }))
          .then((d) => ({
            id: p.id,
            mine: (d.members || []).some((m: any) => m.user.id === myId),
          })),
      ),
    ).then((rows) =>
      setMemberProjectIds(rows.filter((r) => r.mine).map((r) => r.id)),
    );
  }, [projects]);

  // "Your team" (Team Lead overview) = only invited members
  useEffect(() => {
    if (projects.length === 0) {
      setTeamMembers([]);
      return;
    }
    Promise.all(
      projects.map((p) =>
        fetch(`${API}/api/projects/${p.id}/members`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }).then((r) => (r.ok ? r.json() : { members: [] })),
      ),
    ).then((results) => {
      const seen: Record<string, any> = {};
      results.forEach((d) =>
        (d.members || []).forEach((m: any) => {
          seen[m.user.id] = m;
        }),
      );
      setTeamMembers(Object.values(seen));
    });
  }, [projects]);

  // my project invites — loaded on start and re-checked every 10 seconds
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchInvites();
    const timer = setInterval(fetchInvites, 10000);
    return () => clearInterval(timer);
  }, [status]);

  // load history when a task channel is opened
  useEffect(() => {
    if (chatChannel === "general") return;
    fetch(`${API}/api/tasks/${chatChannel}/messages`, {
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setTaskMessages(d.messages || []))
      .catch(() => setTaskMessages([]));
    socket?.emit("join_task", chatChannel);
  }, [chatChannel]);

  const fetchOverview = async () => {
    const res = await fetch(`${API}/api/workspaces/${workspaceId}/overview`, {
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      return;
    }
    setWorkspace(data.workspace);
    setProjects(data.projects || []);
    setMembers(data.members || []);

    // privacy-aware chat list
    const chatRes = await fetch(`${API}/api/workspaces/${workspaceId}/chat`, {
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });
    const chatData = chatRes.ok ? await chatRes.json() : { messages: [] };
    setMessages(chatData.messages || []);
    setLoading(false);
  };

  const connectSocket = () => {
    if (!session?.accessToken || !workspaceId) return;
    const newSocket = io(API, { auth: { token: session.accessToken } });
    newSocket.emit("join_workspace", workspaceId);
    newSocket.on("new_message", (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    });
    newSocket.on("new_task_message", (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      if (message.taskId === chatChannelRef.current) {
        setTaskMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      }
    });
    newSocket.on("new_file", () => {
      // someone in this workspace uploaded a file — refresh the list live
      fetchFiles();
    });
    newSocket.on("task_updated", () => {
      // someone assigned/changed a task — refresh counts and lists live
      fetchOverview();
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  };

  const fetchFiles = async () => {
    const res = await fetch(`${API}/api/workspaces/${workspaceId}/files`, {
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });
    const data = await res.json();
    setFiles(data.files || []);
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch(`${API}/api/invites/mine`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      const data = res.ok ? await res.json() : { invites: [] };
      setMyInvites(data.invites || []);
    } catch {
      // network hiccup — the 10s poll will retry
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectError("");
    const res = await fetch(`${API}/api/workspaces/${workspaceId}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: JSON.stringify({ name: projectName, description: projectDesc }),
    });
    const data = await res.json();
    if (!res.ok) {
      setProjectError(data.error || "Failed to create project");
    } else {
      setProjectName("");
      setProjectDesc("");
      setShowCreateProject(false);
      fetchOverview();
    }
  };

    const handleDeleteProject = async (projectId: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}"? This removes its tasks, chats, files and members — this cannot be undone.`
      )
    )
      return;
    const res = await fetch(
      `${API}/api/workspaces/${workspaceId}/projects/${projectId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // refresh everything that is project-scoped (chat, files, tasks)
      fetchOverview();
      fetchFiles();
    } else {
      alert(data.error || "Could not delete the project");
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setInviteBusy(inviteId);
    setInviteMsg("");
    try {
      const res = await fetch(`${API}/api/invites/${inviteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg(
          `You joined "${data.invite?.project?.name || "the project"}". It now appears in your projects.`,
        );
        fetchOverview();
        fetchInvites();
      } else {
        setInviteMsg(data.error || "Failed to accept invite");
      }
    } finally {
      setInviteBusy("");
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    setInviteBusy(inviteId);
    setInviteMsg("");
    try {
      const res = await fetch(`${API}/api/invites/${inviteId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg("Invite rejected.");
        fetchInvites();
      } else {
        setInviteMsg(data.error || "Failed to reject invite");
      }
    } finally {
      setInviteBusy("");
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !messageInput.trim()) return;
    if (chatChannel === "general") {
      socket.emit("send_message", { workspaceId, content: messageInput });
    } else {
      socket.emit("send_task_message", { taskId: chatChannel, content: messageInput });
    }
    setMessageInput("");
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    if (!selectedFile) {
      setUploadError("Please select a file");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    const res = await fetch(`${API}/api/workspaces/${workspaceId}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.accessToken}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setUploadError(data.error || "Failed to upload file");
    } else {
      setSelectedFile(null);
      fetchFiles();
    }
  };

  const handleDownloadFile = async (file: any) => {
    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.originalName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(file.url, "_blank");
    }
  };

  const myMembership = members.find((m) => m.user.id === session?.user?.id);
  const myRole = myMembership?.role || "EMPLOYEE";
  const isAdmin = myRole === "ADMIN";
  const isTeamLead = myRole === "TEAM_LEAD";
  const isEmployee = myRole === "EMPLOYEE";

  const canManageProjects = isAdmin || isTeamLead;

  const pendingInvites = myInvites.filter((i: any) => i.status === "PENDING");

  const allTasks = projects.flatMap((p) =>
    (p.tasks || []).map((t: any) => ({ ...t, project: p })),
  );
  const myTasks = allTasks.filter((t) => t.assigneeId === session?.user?.id);

  const statusCounts = allTasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    { todo: 0, "in-progress": 0, done: 0 } as Record<string, number>,
  );

  const myStatusCounts = myTasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    { todo: 0, "in-progress": 0, done: 0 } as Record<string, number>,
  );

  // privacy: everyone except Admin only sees projects they are a
  // member of — each Team Lead manages their own separate team
  const chatProjects = isAdmin
    ? projects
    : projects.filter((p) => memberProjectIds.includes(p.id));
  const chatTasks = chatProjects.flatMap((p) => p.tasks || []);

  const generalFiles = files.filter((f) => !f.taskId);
  const taskFileGroups = chatTasks
    .map((t: any) => ({ task: t, files: files.filter((f) => f.taskId === t.id) }))
    .filter((g: any) => g.files.length > 0);

  const generalMessages = messages.filter((m) => !m.taskId);
  const currentChatList =
    chatChannel === "general" ? generalMessages : taskMessages;
  const channelTask = chatTasks.find((t: any) => t.id === chatChannel);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="card text-center">
          <p className="text-lg text-red-600">Workspace not found</p>
          <Link href="/dashboard" className="btn-secondary mt-4">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", show: true },
    { id: "projects", label: "Projects", show: canManageProjects },
    { id: "members", label: "Members", show: isAdmin },
    {
      id: "tasks",
      label: isEmployee ? "My Tasks" : "Assigned Tasks",
      show: true,
    },
    { id: "chat", label: "Chat", show: !isAdmin },
    { id: "files", label: "Files", show: true },
  ].filter((t) => t.show);

  const fileCard = (file: any) => (
    <div key={file.id} className="card flex flex-col justify-between">
      <div>
        <p className="font-semibold text-slate-900 line-clamp-1">
          {file.originalName}
        </p>
        <p className="muted-text mt-1">
          {(file.size / 1024).toFixed(1)} KB •{" "}
          {file.uploadedBy?.name || file.uploadedBy?.email}
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex-1 text-center text-sm"
        >
          View
        </a>
        <button
          onClick={() => handleDownloadFile(file)}
          className="btn-primary flex-1 text-sm"
        >
          Download
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-500 hover:text-indigo-600"
            >
              ← Dashboard
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {workspace.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ROLE_COLORS[myRole] || "bg-slate-100 text-slate-700"
              }`}
            >
              {ROLE_LABELS[myRole] || myRole}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============ PROJECT REQUESTS (pending invites) ============ */}
        {activeTab === "overview" && pendingInvites.length > 0 && (
          <div className="mt-6">
            <div className="card">
              <h2 className="section-title mb-1">Project Requests</h2>
              <p className="muted-text mb-4">
                You have been invited to join these projects. Accept to become
                a member, or Reject to decline.
              </p>
              <div className="space-y-3">
                {pendingInvites.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {inv.project?.name || "Project"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Invited by{" "}
                        {inv.invitedBy?.name || inv.invitedBy?.email} •{" "}
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectInvite(inv.id)}
                        disabled={inviteBusy === inv.id}
                        className="btn-secondary"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAcceptInvite(inv.id)}
                        disabled={inviteBusy === inv.id}
                        className="btn-primary"
                      >
                        {inviteBusy === inv.id ? "Working..." : "Accept"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "overview" && inviteMsg && (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            {inviteMsg}
          </p>
        )}

        {/* ============ OVERVIEW: ADMIN ============ */}
        {activeTab === "overview" && isAdmin && (
          <div className="mt-6 space-y-6">
            <div className="card bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Welcome back, {session?.user?.name || session?.user?.email}
                  </h2>
                  <p className="mt-1 text-purple-100">
                    Everything happening in {workspace.name} at a glance.
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">
                  Admin
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="muted-text">Projects</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {projects.length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Total Tasks</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {allTasks.length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">In Progress</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">
                  {statusCounts["in-progress"] || 0}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Members</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {members.length}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card">
                <p className="muted-text">Admins</p>
                <p className="mt-1 text-3xl font-bold text-purple-600">
                  {members.filter((m) => m.role === "ADMIN").length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Team Leads</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">
                  {members.filter((m) => m.role === "TEAM_LEAD").length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Employees</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">
                  {members.filter((m) => m.role === "EMPLOYEE").length}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="section-title mb-4">Latest tasks</h3>
                <div className="space-y-3">
                  {allTasks.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/${workspaceId}/projects/${t.project.id}?task=${t.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {t.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.project.name} •{" "}
                          {t.assignee?.name || t.assignee?.email || "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </Link>
                  ))}
                  {allTasks.length === 0 && (
                    <p className="text-sm text-slate-400">No tasks yet.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="section-title mb-4">Members</h3>
                <div className="space-y-3">
                  {members.slice(0, 6).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {m.user?.name || m.user?.email}
                        </p>
                        <p className="text-xs text-slate-500">{m.user?.email}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_COLORS[m.role] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-sm text-slate-400">No members yet.</p>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Add, remove, or change roles in the Members tab.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============ OVERVIEW: TEAM LEAD ============ */}
        {activeTab === "overview" && isTeamLead && (
          <div className="mt-6 space-y-6">
            <div className="card bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Welcome back, {session?.user?.name || session?.user?.email}
                  </h2>
                  <p className="mt-1 text-blue-100">
                    Here is what your team is working on right now.
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">
                  Team Lead
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="muted-text">Projects</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {projects.length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">To Do</p>
                <p className="mt-1 text-3xl font-bold text-slate-700">
                  {statusCounts.todo || 0}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">In Progress</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">
                  {statusCounts["in-progress"] || 0}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Done</p>
                <p className="mt-1 text-3xl font-bold text-green-600">
                  {statusCounts.done || 0}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="section-title mb-4">Latest tasks</h3>
                <div className="space-y-3">
                  {allTasks.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/${workspaceId}/projects/${t.project.id}?task=${t.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {t.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.project.name} •{" "}
                          {t.assignee?.name || t.assignee?.email || "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </Link>
                  ))}
                  {allTasks.length === 0 && (
                    <p className="text-sm text-slate-400">No tasks yet.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="section-title mb-4">Your team</h3>
                <div className="space-y-3">
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-slate-400">
                      No members invited yet.
                    </p>
                  )}
                  {teamMembers.map((m: any) => {
                    const ws = members.find((w) => w.user.id === m.user.id);
                    const role = ws?.role || "EMPLOYEE";
                    return (
                      <div
                        key={m.user.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {m.user.name || m.user.email}
                          </p>
                          <p className="text-xs text-slate-500">
                            {m.user.email}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            ROLE_COLORS[role] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ROLE_LABELS[role] || role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ OVERVIEW: EMPLOYEE ============ */}
        {activeTab === "overview" && isEmployee && (
          <div className="mt-6 space-y-6">
            <div className="card bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Welcome back, {session?.user?.name || session?.user?.email}
                  </h2>
                  <p className="mt-1 text-emerald-100">
                    Your tasks and projects at a glance.
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">
                  Employee
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="muted-text">My Tasks</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {myTasks.length}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">To Do</p>
                <p className="mt-1 text-3xl font-bold text-slate-700">
                  {myStatusCounts.todo || 0}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">In Progress</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">
                  {myStatusCounts["in-progress"] || 0}
                </p>
              </div>
              <div className="card">
                <p className="muted-text">Done</p>
                <p className="mt-1 text-3xl font-bold text-green-600">
                  {myStatusCounts.done || 0}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="section-title mb-4">My tasks</h3>
                <div className="space-y-3">
                  {myTasks.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/${workspaceId}/projects/${t.project.id}?task=${t.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {t.title}
                        </p>
                        <p className="text-xs text-slate-500">{t.project.name}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </Link>
                  ))}
                  {myTasks.length === 0 && (
                    <p className="text-sm text-slate-400">
                      No tasks assigned yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="section-title mb-4">My projects</h3>
                <div className="space-y-3">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/${workspaceId}/projects/${p.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {p.name}
                      </p>
                      <span className="text-xs text-slate-500">
                        {p.tasks?.length || 0} tasks
                      </span>
                    </Link>
                  ))}
                  {projects.length === 0 && (
                    <p className="text-sm text-slate-400">
                      You are not part of a project yet. It will appear here
                      once a Team Lead or Admin invites you.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ PROJECTS ============ */}
        {activeTab === "projects" && canManageProjects && (
          <div className="mt-6 space-y-6">
            {isTeamLead && (
              <div className="card">
                <button
                  onClick={() => setShowCreateProject((v) => !v)}
                  className="btn-primary"
                >
                  {showCreateProject ? "− Close" : "+ New Project"}
                </button>

                {showCreateProject && (
                  <div className="mt-4">
                    {projectError && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {projectError}
                      </div>
                    )}
                    <form onSubmit={handleCreateProject} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Project Name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="input"
                        required
                      />
                      <textarea
                        placeholder="Description"
                        value={projectDesc}
                        onChange={(e) => setProjectDesc(e.target.value)}
                        className="input min-h-[100px]"
                      />
                      <button type="submit" className="btn-primary">
                        Create Project
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 className="section-title mb-4">Projects</h2>
              {projects.length === 0 ? (
                <div className="card py-12 text-center">
                  <p className="text-lg font-medium text-slate-600">
                    No Projects Created Yet
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/${workspaceId}/projects/${project.id}`}
                      className="card group relative transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {(isAdmin || isTeamLead) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteProject(project.id, project.name);
                          }}
                          className="absolute right-3 top-3 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                          title="Delete this project"
                        >
                          Delete
                        </button>
                      )}
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600">
                        {project.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                        {project.description || "No description"}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">
                          {project.tasks?.length || 0} tasks
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ MEMBERS (admin) ============ */}
        {activeTab === "members" && isAdmin && (
          <div className="mt-6">
            <AdminConsole
              workspaceId={workspaceId}
              accessToken={(session?.accessToken as string) || ""}
            />
          </div>
        )}

        {/* ============ TASKS ============ */}
        {activeTab === "tasks" && (
          <div className="mt-6">
            <div className="card">
              <h2 className="section-title mb-4">
                {isEmployee ? "My Tasks" : "Assigned Tasks"}
              </h2>
              {(isEmployee ? myTasks : allTasks).length === 0 ? (
                <p className="text-slate-500">No tasks found.</p>
              ) : (
                <div className="space-y-3">
                  {(isEmployee ? myTasks : allTasks).map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/${workspaceId}/projects/${task.project.id}?task=${task.id}`}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {task.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          Project: {task.project.name} •{" "}
                          {task.assignee?.name ||
                            task.assignee?.email ||
                            "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[task.status] ||
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ CHAT ============ */}
        {activeTab === "chat" && !isAdmin && (
          <div className="mt-6">
            {chatProjects.length === 0 ? (
              <div className="card py-12 text-center">
                <p className="text-lg font-medium text-slate-600">No chats yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  {isEmployee
                    ? "Conversations appear here once you are invited to a project."
                    : "Create a project to start chatting."}
                </p>
              </div>
            ) : (
              <div className="card flex h-[600px] flex-col">
                <h2 className="section-title mb-4">Team Chat</h2>
                <div className="flex min-h-0 flex-1 gap-4">
                  <div className="w-48 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <button
                      onClick={() => {
                        setChatChannel("general");
                        setTaskMessages([]);
                      }}
                      className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                        chatChannel === "general"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      # General
                    </button>
                    {chatTasks.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setChatChannel(t.id);
                          setTaskMessages([]);
                        }}
                        className={`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                          chatChannel === t.id
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        # {t.title}
                      </button>
                    ))}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-xs text-slate-400">
                        {chatChannel === "general"
                          ? "General team conversation"
                          : `Task channel: ${channelTask?.title || ""}`}
                      </p>
                      {currentChatList.length === 0 ? (
                        <p className="text-center text-slate-400">
                          No messages yet.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {currentChatList.map((msg) => {
                            const isMe = msg.user?.id === session?.user?.id;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                    isMe
                                      ? "bg-indigo-600 text-white"
                                      : "bg-white shadow-sm ring-1 ring-slate-200"
                                  }`}
                                >
                                  <p className="text-xs opacity-80">
                                    {msg.user?.name || msg.user?.email} •{" "}
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                  </p>
                                  <p className="mt-1 text-sm">{msg.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleSendMessage} className="mt-3 flex gap-3">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a message..."
                        className="input flex-1"
                      />
                      <button type="submit" className="btn-primary">
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ FILES ============ */}
        {activeTab === "files" && (
          <div className="mt-6 space-y-6">
            {chatProjects.length === 0 ? (
              <div className="card py-12 text-center">
                <p className="text-lg font-medium text-slate-600">No files yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  {isEmployee
                    ? "Files appear here once you are invited to a project."
                    : "Create a project to start sharing files."}
                </p>
              </div>
            ) : (
              <>
                <div className="card">
                  <h2 className="section-title mb-4">Upload File</h2>
                  {uploadError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {uploadError}
                    </div>
                  )}
                  <form
                    onSubmit={handleFileUpload}
                    className="flex flex-col gap-4 md:flex-row"
                  >
                    <input
                      type="file"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                      className="input flex-1 py-2"
                    />
                    <button type="submit" className="btn-primary whitespace-nowrap">
                      Upload
                    </button>
                  </form>
                </div>

                <div>
                  <h2 className="section-title mb-4">General Files</h2>
                  {generalFiles.length === 0 ? (
                    <div className="card py-8 text-center">
                      <p className="text-slate-500">No general files yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {generalFiles.map((file) => fileCard(file))}
                    </div>
                  )}
                </div>

                {taskFileGroups.map((g: any) => (
                  <div key={g.task.id}>
                    <h2 className="section-title mb-4">
                      Task: {g.task.title}{" "}
                      <span className="text-sm font-normal text-slate-400">
                        ({g.files.length})
                      </span>
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {g.files.map((file: any) => fileCard(file))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}