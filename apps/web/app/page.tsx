import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-5xl font-extrabold text-indigo-600">CollabHub</h1>
      <p className="mt-4 text-xl text-slate-700">
        Multi-tenant project management & team collaboration suite
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="rounded border border-indigo-600 px-6 py-2 text-indigo-600 hover:bg-indigo-50"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
