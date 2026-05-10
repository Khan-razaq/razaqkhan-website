"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "on" | "off";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "auto";
    setTheme(saved);
    setMounted(true);
  }, []);

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
    return <div className="h-[68px] w-[260px]" />;
  }

  const positionMap: Record<Theme, number> = { on: 0, auto: 1, off: 2 };
  const position = positionMap[theme];

  return (
    <div className="inline-flex flex-col items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
        Dark Mode
      </span>

      <div className="flex items-center gap-2">
        {/* ON label */}
        <button
          onClick={() => setTheme("on")}
          className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors"
        >
          On
        </button>

        {/* Track + Auto label */}
        <div className="relative">
          {/* AUTO label centered above track */}
          <button
            onClick={() => setTheme("auto")}
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors"
          >
            Auto
          </button>

          {/* Track (gray base) */}
          <div className="relative w-[120px] h-6 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            {/* Green fill — animates between left half and right half */}
            <div
              className="absolute top-0 h-full bg-green-500 transition-all duration-200 ease-out"
              style={{
                left: position === 0 ? "0%" : position === 1 ? "50%" : "50%",
                width: position === 1 ? "0%" : "50%",
              }}
            />

            {/* Knob */}
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ease-out z-10"
              style={{
                left:
                  position === 0
                    ? "2px"
                    : position === 1
                    ? "calc(50% - 10px)"
                    : "calc(100% - 22px)",
              }}
            />
          </div>
        </div>

        {/* OFF label */}
        <button
          onClick={() => setTheme("off")}
          className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors"
        >
          Off
        </button>
      </div>
    </div>
  );
}