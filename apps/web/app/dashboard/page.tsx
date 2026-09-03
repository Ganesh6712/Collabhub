"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchWorkspaces();
  }, [status]);

  const fetchWorkspaces = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces`,
      {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      },
    );
    const data = await res.json();
    const list = data.workspaces || [];

    // One workspace -> go straight in. No dashboard list at all.
    if (list.length === 1) {
      router.replace(`/dashboard/${list[0].id}`);
      return;
    }

    // No workspace at all -> make sure the shared HQ exists and enter it.
    if (list.length === 0) {
      try {
        const ens = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/ensure`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          },
        );
        if (ens.ok) {
          const d = await ens.json();
          if (d.workspace?.id) {
            router.replace(`/dashboard/${d.workspace.id}`);
            return;
          }
        }
      } catch {
        // fall through to the list view
      }
    }

    setWorkspaces(list);
    setLoading(false);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900">CollabHub</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-2">
          <h1 className="page-title">Your Workspaces</h1>
          <p className="muted-text mt-1">
            Welcome back, {session?.user?.email}
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="card mt-8 py-12 text-center">
            <p className="text-slate-500">
              You are not part of a workspace yet. Ask your Admin to add you
              from the Members page.
            </p>
          </div>
        ) : (
          <>
            <h2 className="section-title mt-10 mb-4">My workspaces</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => {
                const myRole = ws.memberships?.find(
                  (m: any) => m.user.id === session?.user?.id,
                )?.role;
                return (
                  <Link
                    key={ws.id}
                    href={`/dashboard/${ws.id}`}
                    className="group card transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600">
                          {ws.name}
                        </h3>
                        <p className="muted-text mt-1">{ws.slug}</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        {myRole}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      {ws.memberships?.length || 0} members
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}