import "server-only";

// Free company lookup: no paid APIs, no API keys, and nothing is read from
// LinkedIn beyond the link or name the user saved.
//
// 1. Find the company's website (the one saved, Wikidata, or a guessed domain
//    whose page title matches the name).
// 2. Read the homepage for a summary (its meta description) and a careers link.
// 3. Look for a job board (Greenhouse, Lever, Ashby, ...) linked from the
//    homepage or careers page, and count its open roles through the board's
//    public API.
// 4. If the site doesn't link a board, try the name on the boards directly,
//    but flag the result for review since names collide ("figure" is two
//    different companies).

export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "workday" | "other";

export type Capture = {
  name: string | null;
  sourceUrl: string | null;
  website: string | null;
};

export type LookupResult = {
  website: string | null;
  careers_url: string | null;
  ats: Ats | null;
  ats_slug: string | null;
  open_roles: number | null;
  summary: string | null;
  status: "ready" | "needs_review";
  lookup_note: string | null;
};

const USER_AGENT = "Mozilla/5.0 (compatible; razaqkhan-company-tracker/1.0; personal use)";
const MAX_HTML = 1_500_000;

// ---------------------------------------------------------------------------
// Parsing what was captured
// ---------------------------------------------------------------------------

const UPPER_WORDS = new Set(["ai", "ml", "ar", "vr", "io", "hq", "usa", "us", "uk", "3d"]);

function titleCase(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (UPPER_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// Turns whatever was shared (a LinkedIn link, a website, share-sheet text with
// a link in it, or a bare name) into a name, the original link, and a website.
export function parseCapture(input: { url?: string | null; text?: string | null; title?: string | null }): Capture {
  const pieces = [input.url, input.text, input.title].filter((p): p is string => !!p && p.trim() !== "");
  const joined = pieces.join(" ");
  const urlMatch = joined.match(/https?:\/\/[^\s<>"']+/i);
  // The iPhone shortcut sends only the path ("/company/maven-robotics/"):
  // a full link inside the shortcut's address gets split into two links.
  const pathMatch = joined.match(/^\s*\/?(company|school|showcase)\/[^\s/?#]+/i);
  const rawUrl = urlMatch
    ? urlMatch[0].replace(/[).,]+$/, "")
    : pathMatch
      ? `https://www.linkedin.com/${pathMatch[0].trim().replace(/^\//, "")}/`
      : null;

  // A title like "Figure AI | LinkedIn" or "Figure AI: Overview | LinkedIn"
  const titleName = input.title
    ?.replace(/\s*[|·-]\s*LinkedIn\s*$/i, "")
    .replace(/:\s*(Overview|About|Jobs|People|Posts|Life)\s*$/i, "")
    .replace(/^\(\d+\)\s*/, "")
    .trim();

  // Free text with no link is just the name.
  const textName = !rawUrl ? pieces.join(" ").trim() : null;

  if (!rawUrl) {
    return { name: textName || titleName || null, sourceUrl: null, website: null };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { name: titleName || null, sourceUrl: null, website: null };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host.endsWith("linkedin.com")) {
    const m = url.pathname.match(/^\/(company|school|showcase)\/([^/?#]+)/i);
    if (m) {
      const slug = decodeURIComponent(m[2]).toLowerCase();
      return {
        name: titleName || titleCase(slug),
        sourceUrl: `https://www.linkedin.com/${m[1].toLowerCase()}/${slug}/`,
        website: null,
      };
    }
    // A post or job link: keep it, but the name has to come from the title.
    url.search = "";
    url.hash = "";
    return { name: titleName || null, sourceUrl: url.toString(), website: null };
  }

  // Any other link is taken to be the company's own website.
  const domainName = titleCase(host.split(".").slice(-2, -1)[0] ?? host);
  return {
    name: titleName || domainName,
    sourceUrl: `${url.protocol}//${url.host}/`,
    website: `${url.protocol}//${url.host}/`,
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

// Only public http(s) hosts: the website field is user-editable and fetched
// from the server.
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^[\d.]+$/.test(h) || h.includes(":")) return false; // raw IPv4 / IPv6
    return h.includes(".");
  } catch {
    return false;
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<{ url: string; html: string } | null> {
  if (!isSafeUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const html = (await res.text()).slice(0, MAX_HTML);
    return { url: res.url || url, html };
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function metaContent(html: string, key: string): string | null {
  // Attribute order varies: <meta name="x" content="y"> or <meta content="y" property="x">
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameAttr = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (nameAttr !== key) continue;
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    if (content && content.trim()) return decodeEntities(content.trim());
  }
  return null;
}

function pageTitle(html: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeEntities(t.replace(/\s+/g, " ").trim());
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Drops generic suffixes so "Figure AI, Inc." and "Figure" compare equal.
function coreName(name: string): string {
  return normalize(
    name.replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|technologies|technology|labs?|robotics|ai|hq)\b\.?/gi, " ")
  );
}

function slugCandidates(name: string, sourceUrl: string | null): string[] {
  const out = new Set<string>();
  const li = sourceUrl?.match(/linkedin\.com\/(?:company|school|showcase)\/([^/?#]+)/i)?.[1];
  if (li) {
    out.add(li.toLowerCase());
    out.add(li.toLowerCase().replace(/-/g, ""));
  }
  const words = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().split(/[\s-]+/).filter(Boolean);
  if (words.length) {
    out.add(words.join(""));
    out.add(words.join("-"));
    const core = coreName(name);
    if (core) out.add(core);
  }
  return [...out].filter((s) => s.length >= 2).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Finding the website
// ---------------------------------------------------------------------------

type WikidataSearch = { search?: { id: string; label?: string; description?: string }[] };
type WikidataEntities = {
  entities?: Record<string, { claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>;
};

const COMPANY_WORDS = /compan|corporation|startup|manufacturer|business|enterprise|firm|developer|maker|robot|software|technolog|subsidiary|brand/i;

async function websiteFromWikidata(name: string): Promise<{ website: string; description: string | null } | null> {
  const search = await fetchJson<WikidataSearch>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=${encodeURIComponent(name)}`
  );
  const target = coreName(name);
  const hits = (search?.search ?? []).filter(
    (h) => h.description && COMPANY_WORDS.test(h.description) && h.label && coreName(h.label) === target
  );
  if (!hits.length) return null;

  const entities = await fetchJson<WikidataEntities>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${hits.map((h) => h.id).join("|")}`
  );
  for (const hit of hits) {
    const site = entities?.entities?.[hit.id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (site && isSafeUrl(site)) return { website: site, description: hit.description ?? null };
  }
  return null;
}

// Tries likely domains and keeps the first whose page title or site name
// contains the company name.
async function websiteFromGuess(name: string, sourceUrl: string | null): Promise<{ url: string; html: string } | null> {
  const bases = slugCandidates(name, sourceUrl).filter((s) => !s.includes("-")).slice(0, 3);
  const domains: string[] = [];
  // "Skild AI" is skild.ai, not skildai.com (a different company).
  if (/\sai$/i.test(name.trim()) && coreName(name)) domains.push(`${coreName(name)}.ai`);
  for (const b of bases) {
    domains.push(`${b}.com`, `${b}.ai`, `${b}.io`, `${b}robotics.com`, `${b}.co`);
  }
  const target = coreName(name);
  if (!target) return null;

  const results = await Promise.all(
    [...new Set(domains)].slice(0, 12).map(async (d) => {
      const page = await fetchText(`https://${d}/`, 6000);
      if (!page) return null;
      const label = normalize(`${pageTitle(page.html)} ${metaContent(page.html, "og:site_name") ?? ""}`);
      if (!label.includes(target)) return null;
      // A parked or for-sale domain often has the name in its title too.
      if (/domain (is )?for sale|buy this domain|parked/i.test(page.html.slice(0, 20000))) return null;
      return page;
    })
  );
  return results.find((r) => r !== null) ?? null;
}

// ---------------------------------------------------------------------------
// Reading the site
// ---------------------------------------------------------------------------

function findSummary(html: string): string | null {
  const desc = metaContent(html, "og:description") ?? metaContent(html, "description") ?? metaContent(html, "twitter:description");
  if (!desc) return null;
  const clean = desc.replace(/\s+/g, " ").trim();
  return clean.length > 400 ? `${clean.slice(0, 397).trimEnd()}…` : clean;
}

const CAREERS_TEXT = /\b(careers?|jobs|join (us|our team|the team)|open (roles|positions)|we('| a)re hiring|work (with|at) us)\b/i;
const CAREERS_HREF = /\/(careers?|jobs|join-us|joinus|open-roles|work-with-us)(\/|$|\?|#|\.html)/i;

function findCareersLink(html: string, baseUrl: string): string | null {
  const anchors = html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  let byText: string | null = null;
  for (const [, href, inner] of anchors) {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let abs: string;
    try {
      abs = new URL(decodeEntities(href), baseUrl).toString();
    } catch {
      continue;
    }
    if (!abs.startsWith("http")) continue;
    if (detectAts(abs)) return abs; // a direct job-board link is the best answer
    if (CAREERS_HREF.test(new URL(abs).pathname)) return abs;
    if (!byText && text.length < 40 && CAREERS_TEXT.test(text)) byText = abs;
  }
  return byText;
}

type AtsMatch = { ats: Ats; slug: string };

const ATS_PATTERNS: { ats: Ats; re: RegExp }[] = [
  { ats: "greenhouse", re: /(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([A-Za-z0-9_-]+)/i },
  { ats: "greenhouse", re: /greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([A-Za-z0-9_-]+)/i },
  { ats: "lever", re: /jobs(?:\.eu)?\.lever\.co\/([A-Za-z0-9_.-]+)/i },
  { ats: "ashby", re: /jobs\.ashbyhq\.com\/([A-Za-z0-9_.%-]+)/i },
  { ats: "workable", re: /apply\.workable\.com\/([A-Za-z0-9_-]+)/i },
  { ats: "smartrecruiters", re: /(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i },
  { ats: "workday", re: /([A-Za-z0-9_-]+\.wd\d+\.myworkdayjobs\.com(?:\/[a-z]{2}-[A-Z]{2})?\/[A-Za-z0-9_-]+)/i },
];

const NOT_SLUGS = new Set(["embed", "api", "v1", "jobs", "js", "job_board", "static", "assets"]);

function detectAts(text: string): AtsMatch | null {
  for (const { ats, re } of ATS_PATTERNS) {
    const slug = text.match(re)?.[1];
    if (slug && !NOT_SLUGS.has(slug.toLowerCase())) return { ats, slug: decodeURIComponent(slug) };
  }
  return null;
}

function boardUrl({ ats, slug }: AtsMatch): string {
  switch (ats) {
    case "greenhouse":
      return `https://job-boards.greenhouse.io/${slug}`;
    case "lever":
      return `https://jobs.lever.co/${slug}`;
    case "ashby":
      return `https://jobs.ashbyhq.com/${slug}`;
    case "workable":
      return `https://apply.workable.com/${slug}/`;
    case "smartrecruiters":
      return `https://jobs.smartrecruiters.com/${slug}`;
    default:
      return `https://${slug}`;
  }
}

// Open roles on a job board, or null if the board doesn't exist (or, for
// Workday, can't be counted through a public API).
export async function countOpenRoles({ ats, slug }: AtsMatch): Promise<number | null> {
  const s = encodeURIComponent(slug);
  switch (ats) {
    case "greenhouse": {
      const data = await fetchJson<{ jobs?: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs`);
      return data?.jobs ? data.jobs.length : null;
    }
    case "lever": {
      const data = await fetchJson<unknown[]>(`https://api.lever.co/v0/postings/${s}?mode=json`, 15000);
      return Array.isArray(data) ? data.length : null;
    }
    case "ashby": {
      const data = await fetchJson<{ jobs?: unknown[] }>(`https://api.ashbyhq.com/posting-api/job-board/${s}`);
      return data?.jobs ? data.jobs.length : null;
    }
    case "workable": {
      const data = await fetchJson<{ jobs?: unknown[] }>(`https://apply.workable.com/api/v1/widget/accounts/${s}`);
      return data?.jobs ? data.jobs.length : null;
    }
    case "smartrecruiters": {
      // Unknown companies return 200 with zero results, so zero means "not found".
      const data = await fetchJson<{ totalFound?: number }>(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`);
      return data?.totalFound ? data.totalFound : null;
    }
    default:
      return null;
  }
}

// Last resort: try the name on the boards with public APIs. Greenhouse
// reports the board's company name, so it can be checked.
async function guessBoard(name: string, sourceUrl: string | null): Promise<(AtsMatch & { roles: number; confident: boolean }) | null> {
  const target = coreName(name);
  for (const slug of slugCandidates(name, sourceUrl)) {
    const gh = await fetchJson<{ name?: string }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`);
    if (gh?.name) {
      const roles = await countOpenRoles({ ats: "greenhouse", slug });
      if (roles !== null) return { ats: "greenhouse", slug, roles, confident: coreName(gh.name) === target };
    }
    for (const ats of ["ashby", "lever"] as const) {
      const roles = await countOpenRoles({ ats, slug });
      if (roles !== null) return { ats, slug, roles, confident: false };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The whole lookup
// ---------------------------------------------------------------------------

export async function lookupCompany(company: {
  name: string;
  source_url: string | null;
  website: string | null;
  careers_url: string | null;
}): Promise<LookupResult> {
  const notes: string[] = [];
  let summary: string | null = null;
  let website = company.website && isSafeUrl(company.website) ? company.website : null;
  let home: { url: string; html: string } | null = null;
  let websiteGuessed = false;

  // 1. Website
  if (website) {
    home = await fetchText(website);
    if (!home) notes.push("Couldn't load the saved website.");
  } else {
    const wiki = await websiteFromWikidata(company.name);
    if (wiki) {
      website = wiki.website;
      home = await fetchText(website);
      if (wiki.description) summary = wiki.description.charAt(0).toUpperCase() + wiki.description.slice(1) + ".";
    }
    if (!home) {
      const guessed = await websiteFromGuess(company.name, company.source_url);
      if (guessed) {
        home = guessed;
        website = new URL(guessed.url).origin + "/";
        websiteGuessed = true;
      }
    }
    if (!website) notes.push("Couldn't find the website. Add it and look up again.");
  }

  // 2. Summary and careers page
  let careersUrl = company.careers_url;
  let atsMatch: AtsMatch | null = careersUrl ? detectAts(careersUrl) : null;

  if (home) {
    website = new URL(home.url).origin + "/";
    summary = findSummary(home.html) ?? summary;
    atsMatch = atsMatch ?? detectAts(home.html);
    if (!careersUrl) careersUrl = findCareersLink(home.html, home.url);

    // Common paths when the homepage doesn't link one (or links it from JS).
    if (!careersUrl && !atsMatch) {
      for (const path of ["/careers", "/jobs", "/company/careers"]) {
        const page = await fetchText(new URL(path, home.url).toString(), 6000);
        if (page) {
          careersUrl = page.url;
          atsMatch = detectAts(page.url) ?? detectAts(page.html);
          break;
        }
      }
    }
  }

  // 3. Job board via the careers page
  if (careersUrl && !atsMatch) {
    atsMatch = detectAts(careersUrl);
    if (!atsMatch) {
      const page = await fetchText(careersUrl);
      if (page) atsMatch = detectAts(page.url) ?? detectAts(page.html);
    }
  }

  let openRoles: number | null = null;
  // A guessed domain is trusted only if it links to a job board itself.
  let confident = !websiteGuessed || atsMatch !== null;
  if (websiteGuessed && !atsMatch) notes.push("Website guessed from the name. Check it's the right company.");
  if (atsMatch) {
    openRoles = await countOpenRoles(atsMatch);
    if (openRoles === null && atsMatch.ats !== "workday") {
      notes.push(`Found a ${atsMatch.ats} link but couldn't read its job list.`);
    }
  } else {
    // 4. Guess from the name
    const guess = await guessBoard(company.name, company.source_url);
    if (guess) {
      atsMatch = guess;
      openRoles = guess.roles;
      confident = confident && guess.confident;
      if (!confident) notes.push(`Job board guessed from the name (${guess.ats}). Check it's the right company.`);
    } else if (careersUrl) {
      notes.push("Careers page found, but no job board with a public list. Check it by hand.");
    }
  }

  if (atsMatch && (!careersUrl || !detectAts(careersUrl))) {
    // Prefer the board itself over a generic careers page: that's where roles are.
    careersUrl = atsMatch.ats === "workday" ? `https://${atsMatch.slug}` : boardUrl(atsMatch);
  }
  if (!careersUrl && !atsMatch) notes.push("No careers page found.");

  const status = website && careersUrl && confident ? "ready" : "needs_review";

  return {
    website,
    careers_url: careersUrl,
    ats: atsMatch?.ats ?? (careersUrl ? "other" : null),
    ats_slug: atsMatch?.ats === "workday" ? null : atsMatch?.slug ?? null,
    open_roles: openRoles,
    summary,
    status,
    lookup_note: notes.length ? notes.join(" ") : null,
  };
}
