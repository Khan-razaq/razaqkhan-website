import Link from "next/link";
import { projects } from "@/lib/projects";


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

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top nav */}
      <nav className="max-w-5xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
          ← Razaq Khan
        </Link>
        
        <a  href="/razaq-khan-resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
          Resume
        </a>
      </nav>

      <section className="max-w-5xl mx-auto px-6 md:px-12 pt-12 pb-24">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
            Selected work
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Projects
          </h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg text-slate-600 dark:text-slate-400">
            A working list of what I&apos;ve built and what I&apos;m building. Each project is documented as I have time.
          </p>
        </header>

        <div className="space-y-4">
          {projects.map((project) => (
            <Link
              key={project.slug}
              href={`/projects/${project.slug}`}
              className="group block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 hover:border-teal-500 dark:hover:border-teal-400 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {project.title}
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${STATUS_STYLE[project.status]}`}>
                  {STATUS_LABEL[project.status]}
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                {project.oneLine}
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}