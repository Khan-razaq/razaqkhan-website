"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addCompany } from "../actions";

type State = { kind: "saving" } | { kind: "saved"; name: string; duplicate: boolean } | { kind: "error"; text: string };

export default function AddCompany({
  url,
  title,
  text,
  closeWhenDone,
}: {
  url: string | null;
  title: string | null;
  text: string | null;
  closeWhenDone: boolean;
}) {
  const nothingShared = !url && !text && !title;
  const [state, setState] = useState<State>(
    nothingShared ? { kind: "error", text: "Nothing was shared." } : { kind: "saving" }
  );
  // Effects run twice in development; save only once.
  const started = useRef(false);

  useEffect(() => {
    if (nothingShared || started.current) return;
    started.current = true;
    addCompany({ url, title, text }).then((result) => {
      if (!result.ok) {
        setState({ kind: "error", text: result.error });
        return;
      }
      setState({ kind: "saved", name: result.name, duplicate: result.duplicate });
      // The bookmark opens this in a small popup; close it once saved.
      if (closeWhenDone) setTimeout(() => window.close(), 1200);
    });
  }, [nothingShared, url, title, text, closeWhenDone]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 text-center">
        {state.kind === "saving" && <p className="text-sm text-gray-600 dark:text-gray-400">Saving…</p>}
        {state.kind === "saved" && (
          <>
            <p className="text-2xl mb-2" aria-hidden>
              ✓
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {state.duplicate ? `${state.name} was already saved` : `Saved ${state.name}`}
            </p>
            {!state.duplicate && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Its website and careers page are being looked up.
              </p>
            )}
          </>
        )}
        {state.kind === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.text}</p>}
        <Link
          href="/companies"
          className="inline-block mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open companies →
        </Link>
      </div>
    </main>
  );
}
