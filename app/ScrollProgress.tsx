"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ScrollProgress() {
  const [thumb, setThumb] = useState({ width: 0, left: 0 });
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      const pageHeight = document.documentElement.scrollHeight;
      const viewHeight = window.innerHeight;
      const scrollable = pageHeight - viewHeight;

      if (scrollable <= 0) {
        setThumb({ width: 0, left: 0 });
        return;
      }

      const width = Math.max((viewHeight / pageHeight) * 100, 6);
      const progress = window.scrollY / scrollable;
      const left = progress * (100 - width);

      setThumb({ width, left });
    };

    update();

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const observer = new ResizeObserver(update);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-50 h-[3px] w-full pointer-events-none"
    >
      <div
        className="absolute top-0 h-full rounded-full bg-teal-600 dark:bg-teal-400"
        style={{ width: `${thumb.width}%`, left: `${thumb.left}%` }}
      />
    </div>
  );
}