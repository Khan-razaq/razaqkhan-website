"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// "on" is dark, "off" is light (the values layout.tsx reads on load).
type Theme = "auto" | "on" | "off";

const noopSubscribe = () => () => {};

// One round icon: tap to go Auto → Light → Dark. The icon shows the current
// mode; the ring is drawn in the text color so it stands out on either
// background.
const NEXT: Record<Theme, Theme> = { auto: "off", off: "on", on: "auto" };
const NAME: Record<Theme, string> = { auto: "Auto (matches your device)", off: "Light", on: "Dark" };

export default function ThemeToggle() {
  // false during server render and hydration, true once running in the browser
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined"
      ? "auto"
      : (localStorage.getItem("theme") as Theme) || "auto"
  );

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    const apply = () => {
      const isDark =
        theme === "on" ||
        (theme === "auto" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      root.classList.toggle("dark", isDark);
    };

    apply();
    localStorage.setItem("theme", theme);

    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${NAME[theme]}. Tap to change.`}
      title={`Theme: ${NAME[theme]}`}
      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full border-[1.5px] border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 cursor-pointer transition-[background-color,transform] duration-150"
    >
      <svg
        key={theme}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="animate-[theme-icon-in_200ms_ease-out]"
      >
        {theme === "auto" && (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
          </>
        )}
        {theme === "off" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {theme === "on" && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />}
      </svg>
    </button>
  );
}
