"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The private tools, kept separate (own pages, own data) but one tap apart:
// a round grid icon, styled like the theme icon, opens a small menu.
const APPS = [
  {
    href: "/finance",
    name: "Finance",
    icon: (
      <>
        <path d="M17 8V5a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6" />
        <path d="M20 12v4h-4a2 2 0 0 1 0-4h4" />
      </>
    ),
  },
  {
    href: "/companies",
    name: "Companies",
    icon: (
      <>
        <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      </>
    ),
  },
];

export default function AppSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The menu opens towards the side with room: leftward when the icon is at
  // the right of the header, rightward when a narrow screen puts it at the left.
  const [alignLeft, setAlignLeft] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && ref.current) setAlignLeft(ref.current.getBoundingClientRect().right < 200);
    setOpen(!open);
  };

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Switch between Finance and Companies"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch app"
        className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full border-[1.5px] border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 cursor-pointer transition-[background-color,transform] duration-150"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${alignLeft ? "left-0" : "right-0"} top-10 z-50 w-44 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-lg animate-[menu-in_120ms_ease-out]`}
        >
          {APPS.map((app) => {
            const current = pathname === app.href || pathname.startsWith(`${app.href}/`);
            return (
              <Link
                key={app.href}
                href={app.href}
                role="menuitem"
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {app.icon}
                </svg>
                {app.name}
                {current && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-teal-600 dark:text-teal-400" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
