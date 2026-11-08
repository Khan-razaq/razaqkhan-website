"use client";

import { useEffect, useState } from "react";

// The email address with a small copy button that says "Copied" for a moment.
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Email address copied" : `Copy email address ${email}`}
      className="group inline-flex items-center gap-2 min-h-11 -my-2 font-mono text-[13px] text-(--h-muted) hover:text-(--h-ink) cursor-pointer bg-transparent border-0 p-0"
    >
      <span>{email}</span>
      <span className="inline-flex items-center gap-1 rounded-md border border-(--h-line2) px-1.5 py-0.5 text-[11px] uppercase tracking-[0.06em] group-hover:border-(--h-ink)">
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {copied ? <path d="m5 12 5 5 9-10" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>}
        </svg>
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </span>
    </button>
  );
}
