"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Sign in to your expense tracker.
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white active:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}