import Link from "next/link";
import { notFound } from "next/navigation";
import { projects } from "@/lib/projects";


export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const STATUS_LABEL: Record<string, string> = {
    live: "Live",
    "in-progress": "In progress",
    planned: "Planned",
  };

  const STATUS_STYLE: Record<string, string> = {
    live: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    "in-progress": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    planned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top nav */}
      <nav className="max-w-4xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
        <Link
          href="/projects"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          ← All projects
        </Link>
        <Link
          href="/"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          Razaq Khan
        </Link>
      </nav>

      <article className="max-w-4xl mx-auto px-6 md:px-12 pt-8 pb-24">
        {/* Header: status + title + tags */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLE[project.status]}`}
            >
              {STATUS_LABEL[project.status]}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
            {project.title}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            {project.oneLine}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Optional links */}
          {(project.githubUrl || project.liveUrl) && (
            <div className="mt-6 flex gap-4 text-sm">
              {project.liveUrl && (
                
                <a  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 dark:text-teal-400 hover:underline">
                  Live →
                </a>
              )}
              {project.githubUrl && (
                
                <a  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 dark:text-teal-400 hover:underline">
                  GitHub →
                </a>
              )}
            </div>
          )}
        </header>

        {/* Status banner for in-progress work */}
        {project.status === "in-progress" && (
          <div className="mb-10 p-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>In progress.</strong> Rebuilding this project with proper documentation, visuals, and demos. Full writeup coming.
            </p>
          </div>
        )}

        {/* OUTCOME — inverted pyramid top */}
        {project.outcome && (
          <section className="mb-12">
            <h2 className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
              Outcome
            </h2>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              {project.outcome}
            </p>
          </section>
        )}

        {/* VISUALS */}
        {project.visuals && project.visuals.length > 0 && (
          <section className="mb-12 space-y-6">
            {project.visuals.map((visual, idx) => (
              <figure key={idx}>
                <img
                  src={visual.src}
                  alt={visual.alt}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800"
                />
                {visual.caption && (
                  <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic">
                    {visual.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </section>
        )}

        {/* MOTIVATION */}
        {project.motivation && (
          <section className="mb-12">
            <h2 className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
              Motivation
            </h2>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              {project.motivation}
            </p>
          </section>
        )}

        {/* SKILLS */}
        {project.skills && project.skills.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
              What I did
            </h2>
            <ul className="space-y-3">
              {project.skills.map((skill, idx) => (
                <li key={idx} className="flex gap-3 text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="text-teal-600 dark:text-teal-400 flex-shrink-0">→</span>
                  <span>{skill}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* TECHNICAL DETAILS — inverted pyramid bottom */}
        {project.technical && (
          <section className="mb-12">
            <h2 className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
              Technical detail
            </h2>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              {project.technical}
            </p>
          </section>
        )}
      </article>
    </main>
  );
}