"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "../ThemeToggle";
import { addCompany, relookupCompany } from "./actions";

export type Company = {
  id: string;
  name: string;
  source_url: string | null;
  website: string | null;
  careers_url: string | null;
  ats: string | null;
  ats_slug: string | null;
  open_roles: number | null;
  summary: string | null;
  status: "pending" | "ready" | "needs_review";
  lookup_note: string | null;
  notes: string | null;
  checked_at: string | null;
  created_at: string;
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300";
const primaryButton =
  "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton =
  "px-3 py-2 rounded-md text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const linkClass = "text-blue-600 dark:text-blue-400 hover:underline";

const noopSubscribe = () => () => {};

const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The note under the save box, kept up to date as the lookup finishes.
function savedMessage(
  message: { text: string; companyId?: string; name?: string; listAtSave?: Company[] },
  companies: Company[]
): string {
  if (!message.companyId) return message.text;
  const saved = companies.find((c) => c.id === message.companyId);
  if (saved) return saved.status === "pending" ? message.text : `Done: ${saved.name} is in the list below.`;
  // Gone after the list reloaded: the lookup found it was a company already
  // saved under another name, and the two were joined.
  if (companies !== message.listAtSave && !companies.some((c) => c.status === "pending")) {
    return `Done: ${message.name} was already saved under another name, so they were joined.`;
  }
  return message.text;
}

export default function CompaniesClient({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
    // Set while the just-saved company is being looked up
    companyId?: string;
    name?: string;
    // The list as it was when saved, to tell "not loaded yet" apart from
    // "merged into a company already saved"
    listAtSave?: Company[];
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_review">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);

  // While any lookup is running in the background, refresh every few seconds
  // so its result shows up without reloading.
  const hasPending = companies.some((c) => c.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) clearInterval(timer);
      else router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [hasPending, router]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter(
      (c) =>
        (filter === "all" || c.status === "needs_review") &&
        (!q || `${c.name} ${c.summary ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(q))
    );
  }, [companies, filter, search]);
  const reviewCount = companies.filter((c) => c.status === "needs_review").length;

  const handleAdd = async (value = input) => {
    const text = value.trim();
    if (!text) return;
    setSaving(true);
    setMessage(null);
    const isUrl = /^https?:\/\//i.test(text);
    const result = await addCompany(isUrl ? { url: text } : { text });
    setSaving(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setInput("");
    setMessage(
      result.duplicate
        ? { kind: "ok", text: `${result.name} is already saved.` }
        : {
            kind: "ok",
            text: `Saved ${result.name}. Looking it up…`,
            companyId: result.id,
            name: result.name,
            listAtSave: companies,
          }
    );
    router.refresh();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login?next=/companies");
    router.refresh();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setInput(text.trim());
        await handleAdd(text);
      }
    } catch {
      setMessage({ kind: "error", text: "Couldn't read the clipboard. Paste into the box instead." });
    }
  };

  const handleRelookup = async (id: string) => {
    setBusyId(id);
    setRowError(null);
    const { error } = await relookupCompany(id);
    setBusyId(null);
    if (error) setRowError({ id, text: error });
    router.refresh();
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Delete ${company.name}?`)) return;
    setBusyId(company.id);
    const { error } = await supabase.from("companies").delete().eq("id", company.id);
    setBusyId(null);
    if (error) setRowError({ id: company.id, text: error.message });
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Companies</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Companies saved from LinkedIn, with their careers pages.
              </p>
            </div>
            <div className="shrink-0 flex items-start gap-3">
              <ThemeToggle />
              <button
                onClick={handleSignOut}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors px-3 py-2"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="space-y-2"
          >
            <label htmlFor="company-input" className="block text-xs text-gray-500 dark:text-gray-400">
              LinkedIn link, website, or company name
            </label>
            <input
              id="company-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://www.linkedin.com/company/…"
              autoComplete="off"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !input.trim()} className={`${primaryButton} flex-1`}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={handlePaste} disabled={saving} className={secondaryButton}>
                Paste &amp; save
              </button>
            </div>
            {message && (
              <p
                className={`text-xs ${
                  message.kind === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {savedMessage(message, companies)}
              </p>
            )}
          </form>
        </section>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer ${
              filter === "all"
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            All ({companies.length})
          </button>
          <button
            onClick={() => setFilter("needs_review")}
            className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer ${
              filter === "needs_review"
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            Needs review ({reviewCount})
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search companies"
            className="ml-auto w-full sm:w-40 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-full text-xs bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300"
          />
        </div>

        {shown.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {companies.length === 0 ? "No companies saved yet." : "Nothing matches."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map((company) =>
              editingId === company.id ? (
                <EditCompany
                  key={company.id}
                  company={company}
                  onDone={(changed) => {
                    setEditingId(null);
                    if (changed) handleRelookup(company.id);
                  }}
                />
              ) : (
                <CompanyCard
                  key={company.id}
                  company={company}
                  busy={busyId === company.id}
                  error={rowError?.id === company.id ? rowError.text : null}
                  onEdit={() => setEditingId(company.id)}
                  onRelookup={() => handleRelookup(company.id)}
                  onDelete={() => handleDelete(company)}
                />
              )
            )}
          </div>
        )}

        <CaptureHelp />
      </div>
    </main>
  );
}

function CompanyCard({
  company,
  busy,
  error,
  onEdit,
  onRelookup,
  onDelete,
}: {
  company: Company;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onRelookup: () => void;
  onDelete: () => void;
}) {
  const pending = company.status === "pending" || busy;
  return (
    <article className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{company.name}</h2>
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className={`text-xs ${linkClass}`}>
              {hostOf(company.website)}
            </a>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <AddedAgo createdAt={company.created_at} />
          {pending ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Looking up…
            </span>
          ) : company.status === "needs_review" ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              Check
            </span>
          ) : null}
        </div>
      </div>

      {company.summary && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{company.summary}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
        {company.careers_url && (
          <a href={company.careers_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {company.ats && ATS_LABELS[company.ats] ? `Jobs on ${ATS_LABELS[company.ats]}` : "Careers page"} ↗
          </a>
        )}
        {company.open_roles !== null && (
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {company.open_roles} open {company.open_roles === 1 ? "role" : "roles"}
          </span>
        )}
        {/* Every company gets a LinkedIn link: its page if we know it,
            otherwise a LinkedIn search for its name. */}
        <a
          href={
            company.source_url && hostOf(company.source_url).includes("linkedin")
              ? company.source_url
              : `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company.name)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 dark:text-gray-400 hover:underline"
        >
          {company.source_url && hostOf(company.source_url).includes("linkedin") ? "LinkedIn" : "Find on LinkedIn"} ↗
        </a>
      </div>

      {company.notes && (
        <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{company.notes}</p>
      )}
      {!pending && company.lookup_note && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{company.lookup_note}</p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
        <button onClick={onEdit} disabled={busy} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer disabled:opacity-50">
          Edit
        </button>
        <button onClick={onRelookup} disabled={pending} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer disabled:opacity-50">
          {busy ? "Looking up…" : "Look up again"}
        </button>
        <button onClick={onDelete} disabled={busy} className="text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50">
          Delete
        </button>
        <span className="ml-auto text-gray-400 dark:text-gray-500">
          Saved {new Date(company.created_at).toLocaleDateString()}
        </span>
      </div>
    </article>
  );
}

// A calendar day on this device, like "2026-10-25". It stays the same all
// day, so it works as a stable useSyncExternalStore snapshot.
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

// "Added today", "Added 3 days ago", "Added 2 months ago", counted in
// calendar days on this device. Renders nothing on the server, which doesn't
// know the viewer's timezone.
function AddedAgo({ createdAt }: { createdAt: string }) {
  const today = useSyncExternalStore(noopSubscribe, () => localDayKey(new Date()), () => null);
  const created = new Date(createdAt);
  if (!today) return null;

  const days = Math.max(0, daysBetween(localDayKey(created), today));
  const label =
    days === 0
      ? "Added today"
      : days === 1
        ? "Added yesterday"
        : days < 60
          ? `Added ${days} days ago`
          : `Added ${Math.floor(days / 30)} months ago`;

  return (
    <time
      dateTime={createdAt}
      className="text-[11px] font-medium text-teal-600 dark:text-teal-400 whitespace-nowrap"
    >
      {label}
    </time>
  );
}

function EditCompany({ company, onDone }: { company: Company; onDone: (lookupAgain: boolean) => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website ?? "");
  const [careersUrl, setCareersUrl] = useState(company.careers_url ?? "");
  const [notes, setNotes] = useState(company.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const withScheme = (url: string) => {
    const u = url.trim();
    if (!u) return null;
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    setError("");
    const newWebsite = withScheme(website);
    const newCareers = withScheme(careersUrl);
    // A new website or careers page is worth a fresh lookup.
    const lookupAgain = newWebsite !== company.website || newCareers !== company.careers_url;
    const { error: e } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        website: newWebsite,
        careers_url: newCareers,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
        // Reset what the old website led to so the lookup starts clean.
        ...(lookupAgain ? { ats: null, ats_slug: null, open_roles: null } : {}),
      })
      .eq("id", company.id);
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.refresh();
    onDone(lookupAgain);
  };

  return (
    <article className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 p-4 space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Website</label>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="example.com"
          inputMode="url"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Careers page</label>
        <input
          value={careersUrl}
          onChange={(e) => setCareersUrl(e.target.value)}
          placeholder="Found automatically if left empty"
          inputMode="url"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className={`${primaryButton} flex-1`}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => onDone(false)} disabled={saving} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </article>
  );
}

// How to save companies without opening this page: share sheet on the phone,
// a bookmark or the extension on the laptop.
function CaptureHelp() {
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  // Empty during server render, the site's address once in the browser
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");

  useEffect(() => {
    if (!origin) return;
    // React refuses javascript: URLs in JSX, so set the bookmarklet directly.
    // A highlighted name is saved by name; otherwise the page's link is saved.
    const code = `javascript:(function(){var s=String(window.getSelection()).trim();var q=s?'text='+encodeURIComponent(s):'url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title);window.open('${origin}/companies/add?close=1&'+q,'_blank','width=420,height=320')})()`;
    bookmarkletRef.current?.setAttribute("href", code);
  }, [origin]);

  return (
    <details className="mt-8 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300">
      <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
        Save from your phone or laptop
      </summary>
      <div className="mt-4 space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Android
          </h3>
          <p className="font-medium text-gray-900 dark:text-gray-100">Set up once:</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li>Open this page in Chrome on your phone.</li>
            <li>
              Tap <b>⋮</b> (top right), then <b>Add to Home screen</b>, then <b>Install</b>.
            </li>
          </ol>
          <p className="font-medium text-gray-900 dark:text-gray-100 mt-3">Then, in the LinkedIn app:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              On a company&apos;s page: tap <b>Share</b>, then <b>Companies</b>.
            </li>
            <li>
              Name in a post: press and hold the name to select it, tap <b>Share</b>, then <b>Companies</b>.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            iPhone
          </h3>
          <p className="font-medium text-gray-900 dark:text-gray-100">Set up once, in the Shortcuts app:</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li>
              Tap <b>+</b> to make a new shortcut and name it <b>Save Company</b>.
            </li>
            <li>
              Tap <b>ⓘ</b> at the bottom and turn on <b>Show in Share Sheet</b>. In the <b>Receive</b> block,
              tick only <b>URLs</b> and <b>Text</b>.
            </li>
            <li>
              Add <b>Get URLs from Input</b> (it uses <b>Shortcut Input</b>).
            </li>
            <li>
              Add <b>Get Component of URL</b>, set it to <b>Path</b>, and pick <b>URLs</b> as its input.
            </li>
            <li>
              Add <b>Text</b> and type{" "}
              <code className="text-xs break-all bg-gray-100 dark:bg-gray-800 px-1 rounded">
                {origin || "https://your-site"}/companies/add?text=
              </code>{" "}
              then, with no space, add the <b>Component of URL</b> bubble.
            </li>
            <li>
              Add <b>Open URLs</b> and pick the <b>Text</b> bubble as what it opens.
            </li>
          </ol>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Sending only the link&apos;s path (and building the address in a Text block) matters: an address with a
            second https:// link inside gets split in two, and Open URLs rejects a joined address as &quot;rich
            text&quot;.
          </p>
          <p className="font-medium text-gray-900 dark:text-gray-100 mt-3">Then, in the LinkedIn app:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              On a company&apos;s page: tap <b>⋯ More</b>, then <b>Share via…</b>, then <b>Save Company</b>.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Laptop
          </h3>
          <p className="font-medium text-gray-900 dark:text-gray-100">Set up once:</p>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li>
              Press <b>Ctrl+Shift+B</b> to show the bookmarks bar under the address bar.
            </li>
            <li>
              Drag this button up onto that bar:{" "}
              <a
                ref={bookmarkletRef}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="inline-block px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 font-medium cursor-grab"
              >
                + Save company
              </a>
            </li>
          </ol>
          <p className="font-medium text-gray-900 dark:text-gray-100 mt-3">Then, whenever you see a company:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              On its LinkedIn page: click <b>+ Save company</b> on the bookmarks bar.
            </li>
            <li>
              Name in a post: highlight the name with your mouse, then click <b>+ Save company</b>.
            </li>
          </ul>
          <p className="mt-1">A small window says &quot;Saved&quot; and closes by itself.</p>
        </div>
      </div>
    </details>
  );
}
