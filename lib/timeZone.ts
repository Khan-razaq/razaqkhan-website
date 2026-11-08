// The time zone of whoever sent a request, so "today" is their today
// wherever they are (Boston this week, California the next), not the
// server's (UTC) or a fixed city's.
//
// Vercel looks up where each request's internet connection is and passes
// the time zone in the x-vercel-ip-timezone header. (Through a VPN, that's
// the VPN's location.) Without it, as when running locally, it's UTC.

export function requestTimeZone(headers: Headers): string {
  const tz = headers.get("x-vercel-ip-timezone");
  return tz && isTimeZone(tz) ? tz : "UTC";
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The calendar date (YYYY-MM-DD) at a moment, in a time zone.
export function dateIn(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

// A date with no time of day (a statement line, a list heading) stored as a
// moment: noon UTC, which is the same calendar day almost everywhere
// (UTC−11 to UTC+11).
export const middayOf = (date: string) => `${date}T12:00:00Z`;
