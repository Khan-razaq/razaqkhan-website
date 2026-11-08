import Image from "next/image";
import Link from "next/link";
import { Amiri } from "next/font/google";
import ThemeToggle from "@/app/ThemeToggle";
import { HeroScene, SalaamSwarm } from "@/app/_home/Scenes";
import CopyEmail from "@/app/_home/CopyEmail";

const amiri = Amiri({ subsets: ["arabic"], weight: "400" });

const EMAIL = "khan.razaqma@gmail.com";
const RESUME = "/razaq-khan-resume.pdf";

// Icons are drawn inline: GitHub and LinkedIn as filled marks, the rest as outlines.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICON = {
  mail: { ...stroke, children: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></> },
  resume: { ...stroke, children: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></> },
  github: { fill: "currentColor", children: <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /> },
  linkedin: { fill: "currentColor", children: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /> },
};

const RESULTS = [
  { big: "8 h → 30 min", small: "Jetson firmware deployment, made push-button for assemblers · Clarapath" },
  { big: "4 h → 10 min", small: "Per-machine validation of a multi-motor subsystem, 30+ checkpoints · Clarapath" },
  { big: "7 robots", small: "An autonomous mowing fleet covering 15 km a day on a 2,500-acre solar farm · Directed Machines" },
  { big: "1st prize", small: "Published with Springer Nature: “ROS Based Autonomous Mobile Manipulator Robot” · Dr. Abdul Kalam Innovation Challenge" },
];

const LAYERS = [
  { step: "01", layer: "Embedded", where: "Farm Sathi, India · 2022–23", title: "One cable for three farm tools", body: "A modular RS485 network joining the tiller, sprayer and plower modules of an agricultural robot, with firmware for their messages and production-ready electrical boxes.", number: "3 subsystems on one bus", broke: "[YOUR STORY]", visual: "[Wiring and bus topology diagram]" },
  { step: "02", layer: "Navigation", where: "Farm Sathi · Introbotics", title: "From teleoperation to waypoints", body: "RTK-GPS waypoint navigation on u-blox with a Pixhawk / ArduPilot controller for a field robot, and an indoor logistics AMR mapped with gmapping and localized with AMCL.", number: "Centimetre-level RTK fixes", broke: "[YOUR STORY]", visual: "[The map the AMR built, as an RViz recording]" },
  { step: "03", layer: "Perception", where: "Northeastern · 2025", title: "Seeing terrain for a quadruped", body: "A ROS2 / RealSense elevation-mapping pipeline benchmarked on a Jetson Nano against a laptop for frame rate, CPU and heat, plus a Gazebo quadruped with a custom URDF for foothold detection.", number: "Jetson Nano vs laptop, profiled", broke: "[YOUR STORY]", visual: "[Elevation map replay]" },
  { step: "04", layer: "Manipulation", where: "Introbotics · published", title: "A 5-DOF arm that finds and picks", body: "Vision-guided pick and place: YOLO and OpenCV find the object, MoveIt plans the arm. The mobile manipulator work became a paper with Springer Nature and won first prize.", number: "Published · 1st prize", broke: "[YOUR STORY]", visual: "[Pick-and-place clip or MoveIt replay]" },
  { step: "05", layer: "Tooling and safety", where: "Clarapath, New York · 2024", title: "Making production boring, on purpose", body: "A one-click Jetson flashing tool for assemblers, Voila GUIs that drive motors and read encoders through 30+ checks, and ROS fail-safe logic around PLC door sensors near blades and UV light.", number: "8 h → 30 min · 4 h → 10 min", broke: "[YOUR STORY]", visual: "[Screenshot of the validation GUI]" },
  { step: "06", layer: "The field", where: "Directed Machines, Indiana · 2026", title: "Seven robots, one solar farm", body: "Waypoint plans that thread mowers between panel rows, tuned for post clearance and obstacle width, plus remote calibration fixes and hands-on drivetrain, mower and antenna repairs.", number: "15 km a day · 13 acres a week", broke: "[YOUR STORY]", visual: "[Phone video of the fleet, if allowed]" },
];

const ROUTE = [
  { when: "2022", where: "Introbotics", what: "Indoor AMR, 5-DOF arm" },
  { when: "2022 – 23", where: "Farm Sathi", what: "RTK-GPS field robot, RS485" },
  { when: "2023 – 25", where: "Northeastern", what: "MS Robotics" },
  { when: "2024", where: "Clarapath", what: "Tooling and safety" },
  { when: "2026", where: "Directed Machines", what: "Field fleet, solar farm" },
  { when: "Now", where: "Robotics Field Engineer", what: "Land care robots · perception and controls", now: true },
];

const NOTES = [
  { date: "[DATE]", title: "[A day something broke, and what the robot saw]" },
  { date: "[DATE]", title: "[A fix you were proud of]" },
  { date: "[DATE]", title: "[Something you learned in the field]" },
];

const eyebrow = "font-mono text-[13px] tracking-[0.08em] uppercase text-(--h-accent)";
const wrap = "max-w-[1200px] mx-auto px-4 sm:px-6";

export default function HomePage() {
  return (
    <main className="home min-h-screen font-sans">
      <div className="border-b border-(--h-line) bg-(--h-band) px-4 sm:px-6 py-3.5 flex flex-col items-center gap-1 text-center">
        <p lang="ar" dir="rtl" className={`${amiri.className} m-0 text-lg sm:text-[22px] leading-[1.6]`}>
          لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ
        </p>
        <p className="m-0 text-sm italic text-(--h-muted)">
          &ldquo;The strong is the one who controls himself when angry.&rdquo; — Prophet Muhammad ﷺ
        </p>
      </div>

      <nav aria-label="Main" className={`${wrap} py-4 flex flex-wrap items-center justify-between gap-3`}>
        <a href="#top" className="inline-flex items-center gap-2.5 font-semibold text-[17px] tracking-[-0.01em] no-underline text-(--h-ink)">
          <Image src="/me.jpeg" alt="" width={34} height={34} className="w-[34px] h-[34px] rounded-full object-cover object-top" />
          Razaq Khan
        </a>
        <div className="flex flex-wrap items-center gap-3.5 sm:gap-[22px] text-[15px]">
          <a href="#stack" className="no-underline text-(--h-muted) hover:text-(--h-ink)">Work</a>
          <a href="#route" className="no-underline text-(--h-muted) hover:text-(--h-ink)">Route</a>
          <a href="#notes" className="no-underline text-(--h-muted) hover:text-(--h-ink)">Notes</a>
          <a href={RESUME} target="_blank" rel="noopener noreferrer" className="no-underline text-(--h-muted) hover:text-(--h-ink)">Resume</a>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero on the left, introduction and links on the right; stacked on smaller screens. */}
      <header id="top" className={`${wrap} pt-2 lg:pt-4`}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:items-center">
          <div className="min-w-0">
            <div className="rounded-2xl overflow-hidden border border-(--h-line)">
              <HeroScene />
            </div>
            <p className="mt-2.5 mx-0.5 mb-0 font-mono text-xs text-(--h-muted)">
              Tap the sun for the time · pull it back and let go · hit a cloud or the tree · tap the name
            </p>
          </div>

          <div className="min-w-0 px-0.5">
            <p className={`${eyebrow} mb-3`}>Robotics engineer · MS Robotics, Northeastern</p>
            <h1 className="m-0 text-[34px] sm:text-[44px] lg:text-[46px] leading-[1.05] tracking-[-0.03em] font-semibold">
              I take robots from the circuit board to the field.
            </h1>
            <p className="mt-4 mb-0 max-w-[600px] text-base sm:text-lg leading-relaxed text-(--h-muted)">
              Embedded networks, SLAM and navigation, perception, manipulation, the tools that make production fast, and a fleet of seven robots mowing a 2,500-acre solar farm. I like the whole stack, and I like it most when it works outside.
            </p>
            {/* One row of actions: email and resume as pills, GitHub and LinkedIn as round icon buttons. */}
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 no-underline bg-(--h-ink) text-(--h-bg) pl-4 pr-5 h-12 rounded-full font-medium text-[15px] transition-transform hover:-translate-y-0.5">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...ICON.mail} />
                Email me
              </a>
              <a href={RESUME} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 no-underline border-[1.5px] border-(--h-ink) text-(--h-ink) pl-4 pr-5 h-12 rounded-full font-medium text-[15px] transition-transform hover:-translate-y-0.5">
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" {...ICON.resume} />
                Resume
              </a>
              <a href="https://github.com/marazaqkhan" target="_blank" rel="noopener noreferrer" aria-label="GitHub: marazaqkhan" title="GitHub" className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-(--h-line2) text-(--h-ink) transition-[transform,border-color] hover:-translate-y-0.5 hover:border-(--h-ink)">
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" {...ICON.github} />
              </a>
              <a href="https://www.linkedin.com/in/razaqkhanma" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn: razaqkhanma" title="LinkedIn" className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-(--h-line2) text-(--h-ink) transition-[transform,border-color] hover:-translate-y-0.5 hover:border-(--h-ink)">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...ICON.linkedin} />
              </a>
            </div>
            {/* Under it, quietly: the address to copy, and the way to all projects. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-(--h-muted)">
              <CopyEmail email={EMAIL} />
              <Link href="/projects" className="group inline-flex items-center gap-1.5 no-underline text-(--h-muted) hover:text-(--h-ink)">
                All projects
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section aria-label="Results" className={`${wrap} pt-8 pb-2`}>
        <div className="flex flex-wrap gap-px bg-(--h-line) border border-(--h-line) rounded-[14px] overflow-hidden">
          {RESULTS.map((r) => (
            <div key={r.big} className="grow basis-[220px] bg-(--h-card) px-[22px] pt-[22px] pb-5">
              <p className="m-0 text-[26px] sm:text-3xl font-semibold tracking-[-0.02em] whitespace-nowrap">{r.big}</p>
              <p className="mt-1.5 mb-0 text-sm leading-normal text-(--h-muted)">{r.small}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="stack" aria-labelledby="stack-h" className={`${wrap} pt-[52px] sm:pt-[72px] pb-2`}>
        <p className={`${eyebrow} mb-2`}>The work, layer by layer</p>
        <h2 id="stack-h" className="mt-0 mb-7 text-[28px] sm:text-4xl tracking-[-0.02em] font-semibold">From the circuit board to the field</h2>
        <div className="flex flex-col gap-4">
          {LAYERS.map((l) => (
            <article key={l.step} className="flex flex-wrap gap-5 bg-(--h-card) border border-(--h-line) rounded-[14px] p-4 sm:p-[22px]">
              <div className="grow basis-[300px] min-w-0 aspect-video rounded-[10px] border-[1.5px] border-dashed border-(--h-line2) flex items-center justify-center text-center p-4 font-mono text-[13px] text-(--h-muted)">
                {l.visual}
              </div>
              <div className="grow-[999] basis-[420px] min-w-0 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono text-xs tracking-[0.06em] uppercase text-(--h-accent)">{l.step} · {l.layer}</span>
                  <span className="text-[13px] text-(--h-muted)">{l.where}</span>
                </div>
                <h3 className="m-0 text-[22px] tracking-[-0.01em] font-semibold">{l.title}</h3>
                <p className="m-0 text-base leading-relaxed text-(--h-muted)">{l.body}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1 text-sm">
                  <span className="font-semibold">{l.number}</span>
                  <span className="text-(--h-muted)">What broke: {l.broke}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="route" aria-labelledby="route-h" className={`${wrap} pt-[52px] sm:pt-[72px] pb-2`}>
        <p className={`${eyebrow} mb-2`}>Route so far</p>
        <h2 id="route-h" className="mt-0 mb-7 text-[28px] sm:text-4xl tracking-[-0.02em] font-semibold">Waypoints</h2>
        <ol className="list-none m-0 p-0 flex flex-wrap gap-x-3 gap-y-4">
          {ROUTE.map((s) => (
            <li key={s.when} className={`grow basis-[150px] min-w-0 border-t-[3px] pt-3 ${s.now ? "border-(--h-accent)" : "border-(--h-line2)"}`}>
              <p className="m-0 font-mono text-xs text-(--h-muted)">{s.when}</p>
              <p className="mt-1.5 mb-0.5 text-base font-semibold">{s.where}</p>
              <p className="m-0 text-sm leading-normal text-(--h-muted)">{s.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="notes" aria-labelledby="notes-h" className={`${wrap} pt-[52px] sm:pt-[72px] pb-2`}>
        <div className="flex flex-wrap gap-8">
          <div className="grow-[999] basis-[560px] min-w-0">
            <p className={`${eyebrow} mb-2`}>Field notes</p>
            <h2 id="notes-h" className="mt-0 mb-5 text-[28px] sm:text-4xl tracking-[-0.02em] font-semibold">What the robot saw today</h2>
            <div className="flex flex-col border-t border-(--h-line)">
              {NOTES.map((n, i) => (
                <a key={i} href="#notes" className="flex flex-wrap gap-x-5 gap-y-1 py-4 border-b border-(--h-line) no-underline text-(--h-ink)">
                  <span className="basis-[120px] shrink-0 font-mono text-[13px] text-(--h-muted)">{n.date}</span>
                  <span className="grow-[999] basis-[240px] text-base">{n.title}</span>
                </a>
              ))}
            </div>
          </div>
          <div className="grow basis-[280px] min-w-0">
            <p className={`${eyebrow} mb-2`}>Education</p>
            <p className="m-0 text-base font-semibold">MS Robotics, Northeastern University</p>
            <p className="mt-0.5 mb-3.5 text-sm text-(--h-muted)">Boston · 2023 – 2025</p>
            <p className="m-0 text-base font-semibold">BE Electronics and Communication, Osmania University</p>
            <p className="mt-0.5 mb-3.5 text-sm text-(--h-muted)">Hyderabad · 2018 – 2022</p>
            <p className={`${eyebrow} mt-[18px] mb-2`}>Off the clock</p>
            <p className="m-0 text-[15px] leading-relaxed text-(--h-muted)">Usually on a trail. [YOUR FAVOURITE HIKE OR TRAIL STATS]</p>
          </div>
        </div>
      </section>

      <footer aria-label="Contact" className={`${wrap} pt-14 sm:pt-20 pb-10`}>
        <div className="rounded-2xl overflow-hidden border border-(--h-line) bg-(--h-card)">
          <SalaamSwarm />
        </div>
        <div className="flex flex-wrap justify-between items-center gap-4 pt-[22px] px-0.5">
          <a href={`mailto:${EMAIL}`} className="text-xl font-medium text-(--h-ink) break-all">{EMAIL}</a>
          <div className="flex flex-wrap gap-5 text-[15px]">
            <a href="https://github.com/marazaqkhan" target="_blank" rel="noopener noreferrer" className="text-(--h-muted) hover:text-(--h-ink)">GitHub</a>
            <a href="https://www.linkedin.com/in/razaqkhanma" target="_blank" rel="noopener noreferrer" className="text-(--h-muted) hover:text-(--h-ink)">LinkedIn</a>
            <Link href="/projects" className="text-(--h-muted) hover:text-(--h-ink)">All projects</Link>
          </div>
        </div>
        <p className="mt-7 mx-0.5 mb-0 font-mono text-xs leading-relaxed text-(--h-muted)">
          I reply to every email. Especially about field robots, navigation and getting hardware out of the lab.
        </p>
      </footer>
    </main>
  );
}
