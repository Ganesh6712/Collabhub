"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-600 active:scale-95"
      title="Sign out of CollabHub"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8H8v8h2" />
        <path d="M11 12h8" />
        <path d="M16.5 9.5L19 12l-2.5 2.5" />
      </svg>
      Logout
    </button>
  );
}