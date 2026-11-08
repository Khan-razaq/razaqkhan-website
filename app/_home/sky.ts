// The visitor's real sky for the hero: current weather plus today's sunrise and
// sunset, from Open-Meteo (free, no key).
//
// Location: by default it is estimated from the browser's time zone (e.g.
// "America/New_York" → New York), so nobody is asked for permission. A visitor can
// opt in to their exact position with the browser's location prompt.

export type Sky = {
  place: string;
  exact: boolean;
  code: number; // WMO weather code
  desc: string;
  cloud: number; // 0..1
  wind: number; // km/h
  temp: number;
  unit: "°F" | "°C";
  rise: number; // local hours, e.g. 6.75
  set: number;
  riseText: string;
  setText: string;
};

const CACHE = "home-sky-v1";
const FRESH_MS = 20 * 60 * 1000;

export function describe(code: number): string {
  if (code === 0) return "clear";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 61) return "light rain";
  if (code === 63) return "rain";
  if (code === 65) return "heavy rain";
  if (code === 66 || code === 67) return "freezing rain";
  if (code === 71) return "light snow";
  if (code === 73 || code === 77) return "snow";
  if (code === 75) return "heavy snow";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code >= 95) return "thunderstorm";
  return "";
}

function fahrenheit() {
  const region = (navigator.language.split("-")[1] || "").toUpperCase();
  return region === "US" || region === "LR" || region === "MM";
}

function hours(iso: string | undefined): number | null {
  const t = iso?.split("T")[1];
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : null;
}

function clock(h: number) {
  const d = new Date();
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The city in the visitor's time zone name, found on the map.
async function placeFromTimeZone(): Promise<{ lat: number; lon: number; name: string } | null> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const parts = tz.split("/");
  if (parts.length < 2 || parts[0] === "Etc") return null;
  const city = parts[parts.length - 1].replace(/_/g, " ");
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const list: { latitude: number; longitude: number; name: string; timezone?: string }[] = data.results || [];
  const hit = list.find((r) => r.timezone === tz) || list[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
}

export async function loadSky(exact?: { lat: number; lon: number }): Promise<Sky | null> {
  if (!exact) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (cached && Date.now() - cached.at < FRESH_MS) return cached.sky as Sky;
    } catch {}
  }
  try {
    const where = exact ? { ...exact, name: "your location" } : await placeFromTimeZone();
    if (!where) return null;
    const f = fahrenheit();
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${where.lat.toFixed(3)}&longitude=${where.lon.toFixed(3)}` +
        `&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset` +
        `&timezone=auto&forecast_days=1&wind_speed_unit=kmh&temperature_unit=${f ? "fahrenheit" : "celsius"}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    const rise = hours(d.daily?.sunrise?.[0]) ?? 6;
    const set = hours(d.daily?.sunset?.[0]) ?? 18;
    const code = Number(d.current?.weather_code ?? 0);
    const sky: Sky = {
      place: where.name,
      exact: !!exact,
      code,
      desc: describe(code),
      cloud: Math.max(0, Math.min(1, Number(d.current?.cloud_cover ?? 30) / 100)),
      wind: Number(d.current?.wind_speed_10m ?? 6),
      temp: Math.round(Number(d.current?.temperature_2m ?? 0)),
      unit: f ? "°F" : "°C",
      rise,
      set: set > rise ? set : rise + 12,
      riseText: clock(rise),
      setText: clock(set),
    };
    if (!exact) {
      try {
        localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), sky }));
      } catch {}
    }
    return sky;
  } catch {
    return null;
  }
}
