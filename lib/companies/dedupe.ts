// Finding and merging duplicate companies.
//
// Two saved companies are the same company when any of these match:
//   - their names, ignoring case, spaces, punctuation and "Inc"/"LLC"-style
//     endings ("Fauna Robotics" = "Faunarobotics" = "fauna-robotics, Inc.")
//   - the name on their LinkedIn link ("/company/maven-robotics/")
//   - their website's address (maven.ai = www.maven.ai)
//
// Kept separate from lookup.ts (which is server-only) so it can be tested on
// its own.

export type CompanyRow = {
  id: string;
  name: string;
  source_url: string | null;
  website: string | null;
  careers_url: string | null;
  ats: string | null;
  ats_slug: string | null;
  open_roles: number | null;
  summary: string | null;
  status: string;
  lookup_note: string | null;
  notes: string | null;
  checked_at: string | null;
  created_at: string;
};

export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|plc|pbc)\b\.?/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function linkedInUrl(url: string | null): string | null {
  const m = url?.match(/linkedin\.com\/(company|school|showcase)\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/${m[1].toLowerCase()}/${decodeURIComponent(m[2]).toLowerCase()}/` : null;
}

function websiteKey(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Every key a company can be matched on.
export function companyKeys(c: { name: string; source_url: string | null; website: string | null }): string[] {
  const keys: string[] = [];
  const n = nameKey(c.name);
  if (n) keys.push(`n:${n}`);
  const li = linkedInUrl(c.source_url);
  if (li) {
    const slug = nameKey(li.split("/").filter(Boolean).pop() ?? "");
    if (slug) keys.push(`n:${slug}`);
  }
  const w = websiteKey(c.website);
  if (w) keys.push(`w:${w}`);
  return keys;
}

// Groups of rows that are the same company (only groups of two or more).
export function findDuplicateGroups(rows: CompanyRow[]): CompanyRow[][] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const firstWithKey = new Map<string, number>();
  rows.forEach((row, i) => {
    for (const key of companyKeys(row)) {
      const j = firstWithKey.get(key);
      if (j === undefined) firstWithKey.set(key, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, CompanyRow[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), row]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

// A page title ("Join a team on a mission - AEye Careers") makes a poor name.
function looksLikePageTitle(name: string): boolean {
  return /\s[|–—-]\s/.test(name) || name.length > 40;
}

const STATUS_RANK: Record<string, number> = { ready: 2, needs_review: 1, pending: 0 };

// The single row a group merges into: the first one saved (so "Added 3 days
// ago" stays true), filled in with the best of what the others know.
export function mergeGroup(group: CompanyRow[]): { keep: CompanyRow; drop: string[] } {
  const byAge = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const oldest = byAge[0];

  // Lookup results from the most trustworthy row: finished and not flagged
  // beats flagged beats still running; then the most recently checked.
  const best = [...group].sort(
    (a, b) =>
      (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0) ||
      (b.checked_at ?? "").localeCompare(a.checked_at ?? "")
  )[0];

  // Name: not a page title, then one with spaces ("Fauna Robotics" over
  // "Faunarobotics"), then the oldest.
  const name = [...byAge].sort(
    (a, b) =>
      Number(looksLikePageTitle(a.name)) - Number(looksLikePageTitle(b.name)) ||
      Number(!a.name.includes(" ")) - Number(!b.name.includes(" "))
  )[0].name;

  const firstSet = <K extends keyof CompanyRow>(key: K): CompanyRow[K] =>
    (best[key] ?? byAge.find((r) => r[key] !== null)?.[key] ?? null) as CompanyRow[K];

  const notes = [...new Set(byAge.map((r) => r.notes?.trim()).filter((n): n is string => !!n))].join("\n");

  return {
    keep: {
      ...oldest,
      name,
      source_url: byAge.map((r) => linkedInUrl(r.source_url)).find(Boolean) ?? oldest.source_url ?? firstSet("source_url"),
      website: firstSet("website"),
      careers_url: firstSet("careers_url"),
      ats: best.ats,
      ats_slug: best.ats_slug,
      open_roles: best.open_roles,
      summary: firstSet("summary"),
      status: best.status,
      lookup_note: best.lookup_note,
      notes: notes || null,
      checked_at: best.checked_at,
    },
    drop: byAge.slice(1).map((r) => r.id),
  };
}
