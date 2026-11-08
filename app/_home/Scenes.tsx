"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { startHero, startSwarm } from "./canvas-scenes";

// Phones get a taller canvas with bigger type; everything else the wide one.
const SMALL = "(max-width: 640px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(SMALL);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useSmall() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(SMALL).matches, () => false);
}

type Fonts = { sans: string; mono: string };
type Start = (c: HTMLCanvasElement, f: Fonts) => () => void;

// The canvases draw text, so they use the page's Geist fonts (next/font gives
// them generated family names, read here from the CSS variables).
function readFonts(): Fonts {
  const s = getComputedStyle(document.documentElement);
  return {
    sans: s.getPropertyValue("--font-geist-sans").trim() || "sans-serif",
    mono: s.getPropertyValue("--font-geist-mono").trim() || "monospace",
  };
}

function useScene(start: Start, small: boolean, side = false) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled && ref.current) stop = start(ref.current, readFonts());
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [start, small, side]);
  return ref;
}

const runHero: Start = (c, f) => startHero(c, f.sans, f.mono);
const runSwarm: Start = (c, f) =>
  startSwarm(c, f.sans, () => document.documentElement.classList.contains("dark"));

// Beside the introduction (large screens) the hero is a 960×600 scene.
const SIDE = "(min-width: 1024px)";
const subscribeSide = (cb: () => void) => {
  const mq = window.matchMedia(SIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useSide() {
  return useSyncExternalStore(subscribeSide, () => window.matchMedia(SIDE).matches, () => true);
}

export function HeroScene() {
  const small = useSmall();
  const side = useSide();
  const size = small ? [720, 820] : side ? [960, 600] : [1280, 560];
  const ref = useScene(runHero, small, side);
  return (
    <canvas
      key={size.join("x")}
      ref={ref}
      width={size[0]}
      height={size[1]}
      role="img"
      aria-label="Interactive scene: the name Razaq Khan rests on a row of small robots on a strip of grass and soil, beside a small tree, under a sky with drifting clouds that follows your local time. Tap the sun to hear the time, pull it back and let go to throw it; clouds it hits burst into mist and drift back later, and the tree sways and stops it. Tap the name to knock it down; the robots carry the letters back."
      className="block w-full h-auto touch-none cursor-grab"
    />
  );
}

export function SalaamSwarm() {
  const small = useSmall();
  const ref = useScene(runSwarm, small);
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
