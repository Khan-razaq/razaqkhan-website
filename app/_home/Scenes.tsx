"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { startSwarm } from "./canvas-scenes";
import { startHero } from "./hero-scene";
import { loadSky, type Sky } from "./sky";

function useMedia(query: string, serverValue: boolean) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}
// Phones get a taller canvas with bigger type; beside the introduction (large
// screens) the hero is 960×600; in between it is the wide 1280×560 one.
const useSmall = () => useMedia("(max-width: 640px)", false);
const useSide = () => useMedia("(min-width: 1024px)", true);

type Fonts = { sans: string; mono: string };

// The canvases draw text, so they use the page's Geist fonts (next/font gives
// them generated family names, read here from the CSS variables).
function readFonts(): Fonts {
  const s = getComputedStyle(document.documentElement);
  return {
    sans: s.getPropertyValue("--font-geist-sans").trim() || "sans-serif",
    mono: s.getPropertyValue("--font-geist-mono").trim() || "monospace",
  };
}

const REFRESH_MS = 20 * 60 * 1000;

export function HeroScene() {
  const small = useSmall();
  const side = useSide();
  const size = small ? [720, 820] : side ? [960, 600] : [1280, 560];
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof startHero> | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const [sky, setSky] = useState<Sky | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");

  const apply = useCallback((k: Sky | null) => {
    if (!k) return;
    skyRef.current = k;
    setSky(k);
    scene.current?.setSky(k);
  }, []);

  // The scene itself; restarted when the canvas changes shape.
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled || !ref.current) return;
      const f = readFonts();
      scene.current = startHero(ref.current, f.sans, f.mono);
      if (skyRef.current) scene.current.setSky(skyRef.current);
    });
    return () => {
      cancelled = true;
      scene.current?.();
      scene.current = null;
    };
  }, [small, side]);

  // The visitor's weather, refreshed every 20 minutes (exact location once chosen).
  useEffect(() => {
    let live = true;
    const refresh = () => {
      const exact = skyRef.current?.exact ? exactCoords.current : undefined;
      loadSky(exact ?? undefined).then((k) => live && apply(k));
    };
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [apply]);

  const exactCoords = useRef<{ lat: number; lon: number } | null>(null);
  const locateExactly = () => {
    if (!navigator.geolocation) return;
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        exactCoords.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        loadSky(exactCoords.current).then((k) => {
          apply(k);
          setLocating("idle");
        });
      },
      () => setLocating("denied"),
      { maximumAge: 30 * 60 * 1000, timeout: 10000 }
    );
  };

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-(--h-line)">
        <canvas
          key={size.join("x")}
          ref={ref}
          width={size[0]}
          height={size[1]}
          role="img"
          aria-label={`Interactive scene: the name Razaq Khan rests on a row of small robots on a strip of grass and soil, beside a small tree, under ${sky ? `the sky over ${sky.place} right now (${sky.desc})` : "a sky that follows your local time"}. Tap the sun to hear the time, pull it back and let go to throw it; clouds it hits burst into mist and drift back later, and the tree sways and stops it. Tap the name to knock it down; the robots carry the letters back.`}
          className="block w-full h-auto touch-none cursor-grab"
        />
      </div>
      <p className="mt-2.5 mx-0.5 mb-0 font-mono text-xs leading-relaxed text-(--h-muted) min-h-[1.25rem]">
        {sky && (
          <>
            Sky over {sky.place}: {sky.desc}, {sky.temp}
            {sky.unit} · sunrise {sky.riseText} · sunset {sky.setText}
            {!sky.exact && locating !== "denied" && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={locateExactly}
                  disabled={locating === "busy"}
                  className="underline underline-offset-2 decoration-(--h-line2) hover:text-(--h-ink) hover:decoration-(--h-ink) cursor-pointer bg-transparent border-0 p-0 font-mono text-xs text-(--h-muted)"
                >
                  {locating === "busy" ? "finding you…" : "use my exact location"}
                </button>
              </>
            )}
          </>
        )}
      </p>
    </>
  );
}

export function SalaamSwarm() {
  const small = useSmall();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled || !ref.current) return;
      stop = startSwarm(ref.current, readFonts().sans, () => document.documentElement.classList.contains("dark"));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [small]);
  return (
    <canvas
      key={small ? "small" : "wide"}
      ref={ref}
      width={small ? 720 : 1280}
      height={small ? 460 : 320}
      role="img"
      aria-label="Small robots that turn to watch your pointer, forming the words Say salaam. Touch the words and they scatter, then regroup."
      className="block w-full h-auto touch-none"
    />
  );
}
