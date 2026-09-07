"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io } from "socket.io-client";

const PRIORITY_COLORS: any = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

const STATUS_COLORS: any = {
  todo: "bg-slate-100 text-slate-700",
  "in-progress": "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

const ROLE_COLORS: any = {
  ADMIN: "bg-purple-100 text-purple-700",
  TEAM_LEAD: "bg-blue-100 text-blue-700",
  EMPLOYEE: "bg-emerald-100 text-emerald-700",
};

const ROLE_LABELS: any = {
  ADMIN: "Admin",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};

const INVITE_STATUS_COLORS: any = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const INVITE_STATUS_LABELS: any = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export default function ProjectDetailClient({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [wsMembers, setWsMembers] = useState<any[]>([]);
  const [projMembers, setProjMembers] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [taskMessages, setTaskMessages] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [activeTab, setActiveTab] = useState("tasks");
  const [subTab, setSubTab] = useState<"details" | "chat" | "files">("details");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [chatChannel, setChatChannel] = useState<string>("general");
  const chatChannelRef = useRef<string>("general");
  chatChannelRef.current = chatChannel;

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState("");

  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState<any>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [inviteMsg, setInviteMsg] = useState("");
  const [projectInvites, setProjectInvites] = useState<any[]>([]);
  const [inviteBusy, setInviteBusy] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL || "";
  const currentUserId = session?.user?.id;

  const myMembership = wsMembers.find((m) => m.user.id === currentUserId);
  const myRole = myMembership?.role || "EMPLOYEE";
  const isAdmin = myRole === "ADMIN";
  const isTeamLead = myRole === "TEAM_LEAD";
  const canManageTasks = isAdmin || isTeamLead;
  const isProjectMember =
    isAdmin || projMembers.some((pm: any) => pm.user.id === currentUserId);

  // users that can be invited: not already a member, no pending invite
  const invitableUsers = allUsers.filter(
    (u: any) =>
      !projMembers.some((pm: any) => pm.user.id === u.id) &&
      !projectInvites.some(
        (inv: any) => inv.user?.id === u.id && inv.status === "PENDING",
      ),
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchData();
      connectSocket();
    }
  }, [status, workspaceId, projectId]);

  // open ?task=... from the workspace task list
  useEffect(() => {
    if (tasks.length === 0) return;
    const q = new URLSearchParams(window.location.search).get("task");
    if (q && tasks.some((t) => t.id === q)) openTask(q);
  }, [tasks]);

  const headers = { Authorization: `Bearer ${session?.accessToken}` };

  const fetchData = async () => {
    setLoadError("");
    try {
      const [projectRes, tasksRes, wsMembersRes, projMembersRes, filesRes, overviewRes, invitesRes] =
        await Promise.all([
          fetch(`${API}/api/projects/${projectId}`, { headers }),
          fetch(`${API}/api/projects/${projectId}/tasks`, { headers }),
          fetch(`${API}/api/workspaces/${workspaceId}/members`, { headers }),
          fetch(`${API}/api/projects/${projectId}/members`, { headers }),
          fetch(`${API}/api/workspaces/${workspaceId}/files`, { headers }),
          fetch(`${API}/api/workspaces/${workspaceId}/overview`, { headers }),
          fetch(`${API}/api/invites/project/${projectId}`, { headers }),
        ]);

      if (!projectRes.ok) {
        const data = await projectRes.json();
        setLoadError(data.error || "Project not found");
        setLoading(false);
        return;
      }

      const projectData = await projectRes.json();
      const tasksData = tasksRes.ok ? await tasksRes.json() : { tasks: [] };
      const wsData = wsMembersRes.ok ? await wsMembersRes.json() : { members: [] };
      const pmData = projMembersRes.ok ? await projMembersRes.json() : { members: [] };
      const filesData = filesRes.ok ? await filesRes.json() : { files: [] };
      const overviewData = overviewRes.ok ? await overviewRes.json() : {};
      const invitesData = invitesRes.ok ? await invitesRes.json() : { invites: [] };

      setProject(projectData.project || null);
      setTasks(tasksData.tasks || []);
      setWsMembers(wsData.members || []);
      setProjMembers(pmData.members || []);
      setFiles(filesData.files || []);
      setMessages(overviewData.messages || []);
      setProjectInvites(invitesData.invites || []);
    } catch (err) {
      console.error("Failed to load project data:", err);
      setLoadError("Failed to load project data");
    } finally {
      setLoading(false);
    }
  };

    const handleDeleteProject = async () => {
    if (
      !confirm(
        `Delete "${project?.name}"? This removes its tasks, chats, files and members — this cannot be undone.`
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
      router.push(`/dashboard/${workspaceId}`);
    } else {
      alert(data.error || "Could not delete the project");
    }
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
    newSocket.on("new_file", (file) => {
      // someone in this workspace uploaded a file — refresh lists live
      fetchProjectFiles();
      if (file?.taskId && file.taskId === chatChannelRef.current) {
        loadTaskFiles(file.taskId);
      }
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  };

  const fetchProjectFiles = async () => {
    try {
      const res = await fetch(`${API}/api/workspaces/${workspaceId}/files`, {
        headers,
      });
      const data = res.ok ? await res.json() : { files: [] };
      setFiles(data.files || []);
    } catch {
      // ignore — the next action will refresh
    }
  };

  const loadTaskMessages = async (taskId: string) => {
    const res = await fetch(`${API}/api/tasks/${taskId}/messages`, { headers });
    const data = res.ok ? await res.json() : { messages: [] };
    setTaskMessages(data.messages || []);
    socket?.emit("join_task", taskId);
  };

  const loadTaskFiles = async (taskId: string) => {
    const res = await fetch(`${API}/api/tasks/${taskId}/files`, { headers });
    const data = res.ok ? await res.json() : { files: [] };
    setTaskFiles(data.files || []);
  };

  const openTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setChatChannel(taskId);
    setSubTab("details");
    loadTaskMessages(taskId);
    loadTaskFiles(taskId);
  };

  const openChannel = (channelId: string) => {
    setChatChannel(channelId);
    setTaskMessages([]);
    if (channelId !== "general") loadTaskMessages(channelId);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const body: any = { title, description, priority };
    if (assigneeId) body.assigneeId = assigneeId;

    const res = await fetch(`${API}/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create task");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setShowCreateTask(false);
      fetchData();
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    const res = await fetch(`${API}/api/projects/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update status");
    }
  };

  const updateAssignee = async (taskId: string, newAssigneeId: string) => {
    const res = await fetch(`${API}/api/projects/${taskId}/assignee`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ assigneeId: newAssigneeId }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update assignee");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const res = await fetch(`${API}/api/projects/${taskId}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      setSelectedTaskId("");
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete task");
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

  const handleInviteSearch = async () => {
    setInviteMsg("");
    const res = await fetch(`${API}/api/users`, { headers });
    const data = res.ok ? await res.json() : { users: [] };
    const q = inviteEmail.trim().toLowerCase();
    const found = (data.users || []).filter((u: any) =>
      u.email.toLowerCase().includes(q),
    );
    setAllUsers(found);
    if (q && found.length === 0) {
      setInviteMsg("No registered user matches that email.");
    }
  };

  // Sends a request — the person joins only after they Accept it.
  const handleInvite = async (email: string) => {
    setInviteMsg("");
    const res = await fetch(`${API}/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteMsg(data.message || "Invite sent — waiting for them to accept.");
      setAllUsers([]);
      setInviteEmail("");
      fetchData();
    } else {
      setInviteMsg(data.error || "Invite failed");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm("Cancel this invite? They will no longer be able to accept it."))
      return;
    setInviteBusy(inviteId);
    try {
      const res = await fetch(`${API}/api/invites/${inviteId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel invite");
      }
    } finally {
      setInviteBusy("");
    }
  };

  const handleRemoveProjectMember = async (userId: string) => {
    if (!confirm("Remove this member from the project?")) return;
    const res = await fetch(`${API}/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) fetchData();
  };

  const handleFileUpload = async (e: React.FormEvent, taskId?: string) => {
    e.preventDefault();
    setUploadError("");
    if (!selectedFile) {
      setUploadError("Please select a file");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);

    const url = taskId
      ? `${API}/api/tasks/${taskId}/files`
      : `${API}/api/workspaces/${workspaceId}/files`;

    const res = await fetch(url, { method: "POST", headers, body: formData });
    const data = await res.json();
    if (!res.ok) {
      setUploadError(data.error || "Failed to upload file");
    } else {
      setSelectedFile(null);
      if (taskId) loadTaskFiles(taskId);
      fetchData();
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

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="card text-center">
          <p className="text-lg text-red-600">{loadError}</p>
          <Link
            href={`/dashboard/${workspaceId}`}
            className="btn-secondary mt-4 inline-block"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  // Separate teams: only the Admin and members of this project can
  // open it. Everyone else gets a clear "no access" page.
  if (!isProjectMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="card text-center">
          <p className="text-lg font-semibold text-slate-800">
            You don't have access to this project
          </p>
          <p className="mt-2 text-sm text-slate-500">
            It belongs to another team. If you should be a member, ask the
            Admin or your Team Lead to invite you — access opens as soon as
            you accept.
          </p>
          <Link
            href={`/dashboard/${workspaceId}`}
            className="btn-secondary mt-4 inline-block"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="card text-center">
          <p className="text-lg text-red-600">Project not found (ID: {projectId})</p>
          <Link
            href={`/dashboard/${workspaceId}`}
            className="btn-secondary mt-4 inline-block"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  const statusCounts = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    { todo: 0, "in-progress": 0, done: 0 } as Record<string, number>,
  );

  const generalMessages = messages.filter((m) => !m.taskId);
  const generalFiles = files.filter((f) => !f.taskId);
  const taskFileGroups = tasks
    .map((t) => ({ task: t, files: files.filter((f) => f.taskId === t.id) }))
    .filter((g) => g.files.length > 0);

  const tabs = [
    { id: "members", label: `Members (${projMembers.length})`, show: isAdmin },
    { id: "invite", label: "Invite Member", show: canManageTasks },
    { id: "tasks", label: `Tasks (${tasks.length})` },
    { id: "chat", label: "Chat" },
    { id: "files", label: "Files" },
  ].filter((t: any) => t.show !== false);

  const fileCard = (file: any) => (
    <div key={file.id} className="card flex flex-col justify-between">
      <div>
        <p className="font-semibold text-slate-900 line-clamp-1">{file.originalName}</p>
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
              href={`/dashboard/${workspaceId}`}
              className="text-sm font-medium text-slate-500 hover:text-indigo-600"
            >
              ← Back to Workspace
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
            {canManageTasks && (
              <button
                onClick={handleDeleteProject}
                className="ml-auto rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                title="Delete this project and everything inside it"
              >
                Delete Project
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
          <p className="mt-2 text-slate-500">
            {project.description || "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {statusCounts.todo || 0} to do
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
              {statusCounts["in-progress"] || 0} in progress
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
              {statusCounts.done || 0} done
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedTaskId("");
              }}
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

        {/* ================= MEMBERS ================= */}
        {activeTab === "members" && (
          <div className="mt-6">
            <div className="card">
              <h2 className="section-title mb-1">Project Members</h2>
              <p className="muted-text mb-4">
                Only these people appear in the assign-task dropdown.
              </p>
              <div className="space-y-3">
                {projMembers.map((pm: any) => {
                  const ws = wsMembers.find((w) => w.user.id === pm.user.id);
                  const role = ws?.role || "EMPLOYEE";
                  return (
                    <div
                      key={pm.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {pm.user.name || pm.user.email}
                        </p>
                        <p className="text-sm text-slate-500">{pm.user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {tasks.filter((t) => t.assigneeId === pm.user.id).length}{" "}
                          task(s)
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            ROLE_COLORS[role] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ROLE_LABELS[role] || role}
                        </span>
                        {canManageTasks && (
                          <button
                            onClick={() => handleRemoveProjectMember(pm.user.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {projMembers.length === 0 && (
                  <p className="text-slate-500">
                    No members invited yet. Use the Invite Member tab.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= INVITE ================= */}
        {activeTab === "invite" && canManageTasks && (
          <div className="mt-6 space-y-6">
            <div className="card">
              <h2 className="section-title mb-1">Invite Member by Email</h2>
              <p className="muted-text mb-4">
                Search any registered user by email and send them a request.
                They join the project only after they Accept it.
              </p>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="email"
                  placeholder="Search by email, e.g. mohan@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input flex-1"
                />
                <button onClick={handleInviteSearch} className="btn-primary whitespace-nowrap">
                  Find
                </button>
              </div>

              {inviteMsg && (
                <p className="mt-3 text-sm text-indigo-700">{inviteMsg}</p>
              )}

              {allUsers.length > 0 && (
                <div className="mt-4 space-y-3">
                  {invitableUsers.map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {u.name || u.email}
                        </p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handleInvite(u.email)}
                        className="btn-primary"
                      >
                        Send Invite
                      </button>
                    </div>
                  ))}
                  {invitableUsers.length === 0 && (
                    <p className="text-sm text-slate-400">
                      Everyone matching that search is already a member or
                      already has a pending invite.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="section-title mb-1">Invites &amp; Requests</h2>
              <p className="muted-text mb-4">
                Everyone you invited to this project and their response.
              </p>
              <div className="space-y-3">
                {projectInvites.length === 0 && (
                  <p className="text-slate-500">No invites sent yet.</p>
                )}
                {projectInvites.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {inv.user?.name || inv.user?.email}
                      </p>
                      <p className="text-sm text-slate-500">
                        {inv.user?.email} • invited by{" "}
                        {inv.invitedBy?.name || inv.invitedBy?.email} •{" "}
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          INVITE_STATUS_COLORS[inv.status] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {INVITE_STATUS_LABELS[inv.status] || inv.status}
                      </span>
                      {inv.status === "PENDING" && (
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          disabled={inviteBusy === inv.id}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TASKS / TASK DETAIL ================= */}
        {activeTab === "tasks" && !selectedTask && (
          <div className="mt-6 space-y-6">
            {canManageTasks && (
              <div className="card">
                <button
                  onClick={() => setShowCreateTask((v) => !v)}
                  className="btn-primary"
                >
                  {showCreateTask ? "− Close" : "+ New Task"}
                </button>

                {showCreateTask && (
                  <div className="mt-4">
                    {error && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}
                    <form
                      onSubmit={handleCreateTask}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <input
                        type="text"
                        placeholder="Task Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input sm:col-span-2"
                        required
                      />
                      <textarea
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input min-h-[100px] sm:col-span-2"
                      />
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="input"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                      </select>
                      <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        className="input"
                      >
                        <option value="">No assignee</option>
                        {projMembers
                          .filter((pm: any) => pm.user.id !== currentUserId)
                          .map((pm: any) => (
                            <option key={pm.user.id} value={pm.user.id}>
                              {pm.user.name || pm.user.email}
                            </option>
                          ))}
                      </select>
                      <div className="sm:col-span-2">
                        <button type="submit" className="btn-primary">
                          Create Task
                        </button>
                      </div>
                    </form>
                    {projMembers.length === 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        Tip: invite members first (Invite Member tab) to assign
                        tasks to them.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 className="section-title mb-4">Tasks — click one to open it</h2>
              {tasks.length === 0 ? (
                <div className="card py-12 text-center">
                  <p className="text-slate-500">No tasks yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task: any) => {
                    const isAssignee = task.assigneeId === currentUserId;
                    const canUpdateStatus = isAssignee || isAdmin;

                    return (
                      <button
                        key={task.id}
                        onClick={() => openTask(task.id)}
                        className="card flex w-full flex-col gap-4 text-left transition hover:-translate-y-0.5 hover:shadow-md md:flex-row md:items-start md:justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {task.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                PRIORITY_COLORS[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {task.description || "No description"}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                STATUS_COLORS[task.status]
                              }`}
                            >
                              {task.status}
                            </span>
                            {canManageTasks ? (
                              <span
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-sm"
                              >
                                <span className="text-slate-500">
                                  Assign to:
                                </span>
                                <select
                                  value={task.assigneeId || ""}
                                  onChange={(e) =>
                                    updateAssignee(task.id, e.target.value)
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                                >
                                  <option value="">Unassigned</option>
                                  {projMembers
                                    .filter(
                                      (pm: any) =>
                                        pm.user.id !== currentUserId,
                                    )
                                    .map((pm: any) => (
                                      <option
                                        key={pm.user.id}
                                        value={pm.user.id}
                                      >
                                        {pm.user.name || pm.user.email}
                                      </option>
                                    ))}
                                </select>
                              </span>
                            ) : task.assignee ? (
                              <span className="text-slate-600">
                                Assigned to{" "}
                                <strong>
                                  {task.assignee.name || task.assignee.email}
                                </strong>
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                            {canUpdateStatus && (
                              <span
                                onClick={(e) => e.stopPropagation()}
                                className="inline-block"
                              >
                                <select
                                  value={task.status}
                                  onChange={(e) =>
                                    updateStatus(task.id, e.target.value)
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                                >
                                  <option value="todo">Todo</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                              </span>
                            )}
                          </div>
                        </div>

                        {isAdmin && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tasks" && selectedTask && (
          <div className="mt-6 space-y-6">
            <button
              onClick={() => setSelectedTaskId("")}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              ← Back to task list
            </button>

            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedTask.title}
                  </h2>
                  <p className="mt-1 text-slate-500">
                    {selectedTask.description || "No description"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    PRIORITY_COLORS[selectedTask.priority]
                  }`}
                >
                  {selectedTask.priority}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {selectedTask.assigneeId === currentUserId || isAdmin ? (
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateStatus(selectedTask.id, e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="todo">Todo</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[selectedTask.status]
                      }`}
                    >
                      {selectedTask.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Only the assigned member or an Admin can change the status.
                    </span>
                  </>
                )}

                {canManageTasks ? (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <span className="text-slate-500">Assign to:</span>
                    <select
                      value={selectedTask.assigneeId || ""}
                      onChange={(e) =>
                        updateAssignee(selectedTask.id, e.target.value)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {projMembers
                        .filter((pm: any) => pm.user.id !== currentUserId)
                        .map((pm: any) => (
                          <option key={pm.user.id} value={pm.user.id}>
                            {pm.user.name || pm.user.email}
                          </option>
                        ))}
                    </select>
                  </span>
                ) : selectedTask.assignee ? (
                  <span className="text-slate-600">
                    Assigned to{" "}
                    <strong>
                      {selectedTask.assignee.name || selectedTask.assignee.email}
                    </strong>
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </div>

              <div className="mt-6 flex gap-2 border-b border-slate-200 pb-1">
                {(
                  [
                    { id: "details", label: "Details" },
                    { id: "chat", label: `Chat (${taskMessages.length})` },
                    { id: "files", label: `Files (${taskFiles.length})` },
                  ] as any[]
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubTab(s.id)}
                    className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                      subTab === s.id
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {subTab === "details" && (
                <div className="mt-4 text-sm text-slate-600">
                  <p>
                    Created: {new Date(selectedTask.createdAt).toLocaleString()}
                  </p>
                  <p>
                    Last update:{" "}
                    {new Date(selectedTask.updatedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {subTab === "chat" && (
                <div className="mt-4 flex h-[420px] flex-col">
                  <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {taskMessages.length === 0 ? (
                      <p className="text-center text-slate-400">
                        No messages for this task yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {taskMessages.map((msg: any) => {
                          const isMe = msg.user?.id === currentUserId;
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
                      placeholder="Discuss this task..."
                      className="input flex-1"
                    />
                    <button type="submit" className="btn-primary">
                      Send
                    </button>
                  </form>
                </div>
              )}

              {subTab === "files" && (
                <div className="mt-4 space-y-4">
                  <form
                    onSubmit={(e) => handleFileUpload(e, selectedTask.id)}
                    className="flex flex-col gap-3 md:flex-row"
                  >
                    <input
                      type="file"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                      className="input flex-1 py-2"
                    />
                    <button type="submit" className="btn-primary whitespace-nowrap">
                      Upload to this task
                    </button>
                  </form>
                  {uploadError && (
                    <p className="text-sm text-red-600">{uploadError}</p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {taskFiles.map((f: any) => fileCard(f))}
                  </div>
                  {taskFiles.length === 0 && (
                    <p className="text-sm text-slate-400">
                      No files on this task yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= CHAT (channels) ================= */}
        {activeTab === "chat" && !isProjectMember && (
          <div className="mt-6">
            <div className="card py-12 text-center">
              <p className="text-lg font-medium text-slate-600">No chats yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Conversations appear once you are invited to this project.
              </p>
            </div>
          </div>
        )}

        {activeTab === "chat" && isProjectMember && (
          <div className="mt-6">
            <div className="card flex h-[600px] flex-col">
              <h2 className="section-title mb-4">Project Chat</h2>
              <div className="flex min-h-0 flex-1 gap-4">
                <div className="w-48 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <button
                    onClick={() => openChannel("general")}
                    className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      chatChannel === "general"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    # General
                  </button>
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openChannel(t.id)}
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
                    {(chatChannel === "general" ? generalMessages : taskMessages)
                      .length === 0 ? (
                      <p className="text-center text-slate-400">No messages yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {(chatChannel === "general"
                          ? generalMessages
                          : taskMessages
                        ).map((msg: any) => {
                          const isMe = msg.user?.id === currentUserId;
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
          </div>
        )}

        {/* ================= FILES (grouped) ================= */}
        {activeTab === "files" && !isProjectMember && (
          <div className="mt-6">
            <div className="card py-12 text-center">
              <p className="text-lg font-medium text-slate-600">No files yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Files appear once you are invited to this project.
              </p>
            </div>
          </div>
        )}

        {activeTab === "files" && isProjectMember && (
          <div className="mt-6 space-y-6">
            <div className="card">
              <h2 className="section-title mb-4">Upload File</h2>
              {uploadError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              )}
              <form
                onSubmit={(e) => handleFileUpload(e)}
                className="flex flex-col gap-4 md:flex-row"
              >
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
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
                  {generalFiles.map((f) => fileCard(f))}
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
                  {g.files.map((f: any) => fileCard(f))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}