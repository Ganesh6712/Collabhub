import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Inline SVG icons (no dependencies, no image files)                 */
/* ------------------------------------------------------------------ */

function IconFolder() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function IconClip() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.52l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <line x1="5" x2="19" y1="21" y2="21" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function IconUserCheck() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: <IconFolder />,
    title: "Workspaces & projects",
    text: "Every team gets its own isolated workspace with separate projects, members and activity.",
  },
  {
    icon: <IconTasks />,
    title: "Tasks & assignees",
    text: "Create tasks with priorities, assign them to teammates and track status from To Do to Done.",
  },
  {
    icon: <IconChat />,
    title: "Real-time chat",
    text: "Talk to your team where the work happens — at the project level or inside a single task.",
  },
  {
    icon: <IconClip />,
    title: "File sharing",
    text: "Upload and share files with the whole project or attach them to specific tasks.",
  },
  {
    icon: <IconShield />,
    title: "Roles & permissions",
    text: "Admins, Team Leads and Employees each see exactly what they need — nothing more.",
  },
  {
    icon: <IconZap />,
    title: "Live updates",
    text: "Assignments and status changes appear on every screen instantly. No refresh needed.",
  },
];

const steps = [
  {
    num: "01",
    title: "Create your workspace",
    text: "Sign up and set up a workspace for your team in under a minute.",
  },
  {
    num: "02",
    title: "Invite your team",
    text: "Add Team Leads and Employees to the projects they work on.",
  },
  {
    num: "03",
    title: "Assign & track",
    text: "Create tasks, assign them and watch updates appear live for everyone.",
  },
];

const roles = [
  {
    icon: <IconCrown />,
    name: "Admin",
    text: "Runs the whole workspace — manages members, creates projects and oversees every team.",
    chip: "bg-indigo-50 text-indigo-700",
  },
  {
    icon: <IconFlag />,
    name: "Team Lead",
    text: "Owns their projects — creates tasks, assigns work to team members and tracks progress.",
    chip: "bg-sky-50 text-sky-700",
  },
  {
    icon: <IconUserCheck />,
    name: "Employee",
    text: "Focuses on the work — sees assigned tasks, updates status, chats and shares files.",
    chip: "bg-emerald-50 text-emerald-700",
  },
];

const boardColumns = [
  {
    name: "To Do",
    pill: "bg-slate-100 text-slate-500",
    tasks: [
      {
        title: "Update the login page",
        who: "Neeraj",
        initials: "N",
        avatar: "bg-violet-500",
        tag: "High",
        tagClass: "bg-rose-50 text-rose-600",
      },
      {
        title: "Fix mobile navbar",
        who: "Unassigned",
        initials: "U",
        avatar: "bg-slate-300",
        tag: "Medium",
        tagClass: "bg-amber-50 text-amber-700",
      },
    ],
  },
  {
    name: "In Progress",
    pill: "bg-sky-50 text-sky-600",
    tasks: [
      {
        title: "Design settings page",
        who: "Raj",
        initials: "R",
        avatar: "bg-sky-500",
        tag: "High",
        tagClass: "bg-rose-50 text-rose-600",
      },
    ],
  },
  {
    name: "Done",
    pill: "bg-emerald-50 text-emerald-600",
    tasks: [
      {
        title: "Set up Neon database",
        who: "Alice",
        initials: "A",
        avatar: "bg-indigo-500",
        tag: "Done",
        tagClass: "bg-emerald-50 text-emerald-600",
      },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ---------------- Navbar ---------------- */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-extrabold text-white">
              C
            </span>
            <span className="text-lg font-bold tracking-tight">CollabHub</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <Link href="#features" className="transition hover:text-indigo-600">
              Features
            </Link>
            <Link href="#how" className="transition hover:text-indigo-600">
              How it works
            </Link>
            <Link href="#roles" className="transition hover:text-indigo-600">
              Roles
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-24">
        {/* soft background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-indigo-100/60 via-violet-50/40 to-transparent"
        />

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            Real-time team collaboration
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Manage projects, tasks and your team —{" "}
            <span className="text-indigo-600">all in one place</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            CollabHub brings your projects, task assignments, files and
            real-time chat together in one clean workspace — built for small
            teams that move fast.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
            >
              Get started free
              <span className="transition group-hover:translate-x-0.5">
                <IconArrowRight />
              </span>
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Login
            </Link>
          </div>

          <p className="mt-5 text-xs font-medium text-slate-500">
            Free to use&nbsp;&nbsp;·&nbsp;&nbsp;Set up in minutes&nbsp;&nbsp;·&nbsp;&nbsp;Live
            updates
          </p>
        </div>

        {/* ---- CSS mini-dashboard preview ---- */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -bottom-10 -top-6 -z-10 rounded-[3rem] bg-gradient-to-b from-indigo-200/50 via-violet-100/40 to-transparent blur-2xl"
          />

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            {/* browser chrome bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <div className="mx-auto hidden rounded-md border border-slate-200 bg-white px-4 py-1 text-xs text-slate-400 sm:block">
                collabhub.app/dashboard
              </div>
            </div>

            <div className="flex text-left">
              {/* sidebar */}
              <div className="hidden w-48 shrink-0 border-r border-slate-200 bg-slate-50/70 p-4 md:block">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-extrabold text-white">
                    C
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    CollabHub HQ
                  </span>
                </div>
                <div className="mt-4 space-y-1">
                  <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                    Overview
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500">
                    Projects
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500">
                    Chat
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500">
                    Files
                  </div>
                </div>
              </div>

              {/* board */}
              <div className="flex-1 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      neon updates
                    </div>
                    <div className="text-xs text-slate-400">
                      Project · 2 members
                    </div>
                  </div>
                  <div className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                    + New Task
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {boardColumns.map((col) => (
                    <div key={col.name} className="min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">
                          {col.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${col.pill}`}
                        >
                          {col.tasks.length}
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {col.tasks.map((t) => (
                          <div
                            key={t.title}
                            className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                          >
                            <div className="truncate text-xs font-semibold text-slate-800">
                              {t.title}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-1">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${t.avatar}`}
                                >
                                  {t.initials}
                                </span>
                                <span className="truncate text-[10px] text-slate-500">
                                  {t.who}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${t.tagClass}`}
                              >
                                {t.tag}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* floating toast — live update feel */}
          <div className="absolute -left-5 -top-5 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xl lg:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <IconZap />
            </span>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800">
                Task moved to In Progress
              </div>
              <div className="text-[10px] text-slate-400">just now · live</div>
            </div>
          </div>

          {/* floating chat bubble */}
          <div className="absolute -bottom-6 -right-5 hidden w-60 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl lg:block">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                R
              </span>
              <span className="text-xs font-bold text-slate-800">
                Task chat · Raj
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="w-fit max-w-[85%] rounded-xl rounded-bl-sm bg-indigo-600 px-2.5 py-1.5 text-[10px] font-medium text-white">
                Starting on the settings page now
              </div>
              <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-slate-100 px-2.5 py-1.5 text-[10px] font-medium text-slate-700">
                Great — I assigned it to you
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="border-t border-slate-100 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Features
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything your team needs
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              One workspace for the whole workflow — from planning the project
              to shipping the task.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-600/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                  {f.icon}
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              How it works
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Up and running in three steps
            </h2>
          </div>

          <div className="relative mt-14 grid gap-10 md:grid-cols-3">
            {/* connector line (desktop) */}
            <div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-6 hidden border-t-2 border-dashed border-indigo-200 md:block"
            />
            {steps.map((s) => (
              <div key={s.num} className="relative text-center">
                <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25">
                  {s.num}
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {s.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section id="roles" className="border-t border-slate-100 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Roles
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Built for the way your team works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Three clear roles keep everyone focused on their own work.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {roles.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${r.chip}`}
                >
                  {r.icon}
                </span>
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {r.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA banner ---------------- */}
      <section className="px-6 py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-16 text-center shadow-2xl shadow-indigo-600/25">
          {/* decorative circles */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-white/10"
          />

          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to organize your team?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Set up your workspace in minutes and see every project, task and
            conversation in one place.
          </p>
          <div className="relative mt-8">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
            >
              Create your workspace
              <span className="transition group-hover:translate-x-0.5">
                <IconArrowRight />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-slate-200 bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-extrabold text-white">
                C
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                CollabHub
              </span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
              <Link href="#features" className="transition hover:text-indigo-600">
                Features
              </Link>
              <Link href="#how" className="transition hover:text-indigo-600">
                How it works
              </Link>
              <Link href="#roles" className="transition hover:text-indigo-600">
                Roles
              </Link>
              <Link href="/login" className="transition hover:text-indigo-600">
                Login
              </Link>
              <Link
                href="/register"
                className="transition hover:text-indigo-600"
              >
                Register
              </Link>
            </nav>
          </div>

          <p className="mt-10 text-center text-xs text-slate-400">
            © 2026 CollabHub · Team workspace &amp; project management
          </p>
        </div>
      </footer>
    </div>
  );
}