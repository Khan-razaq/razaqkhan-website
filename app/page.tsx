"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useState, useEffect } from "react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: var(--start-opacity); }
          50% { opacity: var(--end-opacity); }
        }
        @keyframes sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -20px) scale(1.05); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        @keyframes meteorFly {
          from {
            translate: 0 0;
          }
          to {
            translate: var(--end-x) var(--end-y);
          }
        }
        @keyframes meteorTail {
          0% { width: 0; opacity: 0; }
          15% { width: 30px; opacity: 1; }
          70% { width: 80px; opacity: 1; }
          100% { width: 0; opacity: 0; }
        }

        .fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .fade-delay-1 { animation-delay: 0.1s; }
        .fade-delay-2 { animation-delay: 0.25s; }
        .fade-delay-3 { animation-delay: 0.4s; }
        .fade-delay-4 { animation-delay: 0.55s; }
        .fade-delay-5 { animation-delay: 0.7s; }
        .bg-drift {
          animation: drift 18s ease-in-out infinite;
        }
        .sweep-line {
          animation: sweep 6s linear infinite;
          transform-origin: 200px 200px;
        }
      `}</style>

      {/* Starlight (dark mode only) */}
      <Starlight />

      {/* Background accent — drifts gently */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-teal-500/10 dark:bg-teal-400/8 blur-3xl pointer-events-none bg-drift"
      />

      {/* Top nav — photo, hadith, projects link */}
      <nav className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 md:px-12 py-10">
        <img
          src="/me.jpeg"
          alt="Razaq Khan"
          className="w-30 h-30 rounded-full object-cover object-top border border-slate-200 dark:border-slate-800"
        />
        <div className="hidden md:block text-center">
          <p
            className="text-xl text-slate-700 dark:text-slate-300 leading-tight"
            dir="rtl"
            lang="ar"
            style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
          >
            لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ
          </p>
          <p className="italic text-lg text-slate-500 dark:text-slate-500 mt-1">
            &quot;The strong is the one who controls himself when angry.&quot; — Prophet Mohammad ﷺ (pbuh)          </p>
        </div>
        <Link
          href="/projects"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          Projects
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-2 md:pt-2 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center">
          {/* LEFT */}
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-4 font-medium fade-in-up fade-delay-1">
              Robotics engineer
            </p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] fade-in-up fade-delay-2">
              Razaq <span className="text-teal-600 dark:text-teal-400">Khan</span>
            </h1>

            <p className="mt-10 max-w-2xl text-lg md:text-xl text-slate-700 dark:text-slate-300 leading-relaxed fade-in-up fade-delay-3">
              Robotics engineer at Directed Machines. I work on autonomous land
              care robots, and I&apos;m most interested in perception and
              controls. Off the clock, I&apos;m outdoors — usually hiking.
            </p>

            <div className="mt-10 flex flex-col gap-2 text-sm fade-in-up fade-delay-4">
              <a href="mailto:khan.razaqma@gmail.com" className="group inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors w-fit">
                <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="border-b border-transparent group-hover:border-teal-600 dark:group-hover:border-teal-400 pb-0.5">khan.razaqma@gmail.com</span>
              </a>
              <a href="https://github.com/Khan-razaq" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors w-fit">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="border-b border-transparent group-hover:border-teal-600 dark:group-hover:border-teal-400 pb-0.5">github.com/Khan-razaq</span>
              </a>
              <a href="https://www.linkedin.com/in/razaqkhanma" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors w-fit">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="border-b border-transparent group-hover:border-teal-600 dark:group-hover:border-teal-400 pb-0.5">linkedin.com/in/razaqkhanma</span>
              </a>
            </div>
          </div>

          {/* RIGHT: animated point cloud */}
          <div className="hidden lg:flex justify-center items-center fade-in-up fade-delay-5">
            <PointCloudSVG />
          </div>
        </div>
      </section>

      {/* NOW section */}
        <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-12 pb-24 fade-in-up fade-delay-5">
          <div className="border-l-2 border-teal-500 dark:border-teal-400 pl-6 py-2">
            <p className="text-xs uppercase tracking-[0.25em] text-teal-600 dark:text-teal-400 mb-3 font-medium">
              Now
            </p>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
              Robotics Field Engineer at <strong className="text-slate-900 dark:text-slate-100">Directed Machines</strong>, building autonomous land care robots in Indiana.
            </p>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
              Most days: deploying robots, debugging perception pipelines, getting deeper into controls.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">Updated May 2026.</p>
          </div>
        </section>

        {/* PROJECTS section */}
        <section className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pb-32">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Selected projects
            </h2>
            <Link
              href="/projects"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              All projects →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProjectCard
              slug="point-cloud-elevation"
              title="Point Cloud Elevation Mapping"
              description="Real-time terrain reconstruction from depth sensors for off-road navigation."
              tags={["ROS2", "PCL", "C++"]}
            />
            <ProjectCard
              slug="deepfake-detection"
              title="Deepfake Detection Pipeline"
              description="CNN-based classifier trained on face manipulation datasets with real-time inference."
              tags={["PyTorch", "OpenCV", "Python"]}
            />
            <ProjectCard
              slug="finance-dashboard"
              title="Personal Finance Dashboard"
              description="Full-stack app for tracking expenses, loans, and savings with auto-recommendation engine."
              tags={["Next.js", "Supabase", "TypeScript"]}
            />
          </div>
        </section>
    </main>
  );
}

function Starlight() {
  // Static twinkling stars (unchanged)
  const stars = Array.from({ length: 120 }, (_, i) => {
    const seed = i * 17;
    const x = ((seed * 13) % 1000) / 10;
    const y = ((seed * 23) % 1000) / 10;
    const size = 1 + ((seed * 7) % 30) / 30;
    const duration = 3 + ((seed * 11) % 50) / 10;
    const delay = ((seed * 19) % 100) / 10;
    const opacity = 0.3 + ((seed * 5) % 70) / 100;
    return { x, y, size, duration, delay, opacity };
  });

  // State to hold currently-active meteors
  const [meteors, setMeteors] = useState<Meteor[]>([]);

  // Randomly spawn meteors
  useEffect(() => {
    let active = true;

    const spawn = () => {
      if (!active) return;

      // Random start position (somewhere in upper half of viewport)
      const startX = Math.random() * 100; // vw %
      const startY = Math.random() * 40; // vh %

      // Random angle: meteors fall down-and-to-the-side
      // angleRad between 30° and 60° below horizontal
      const angleDeg = 30 + Math.random() * 30;
      const direction = Math.random() < 0.5 ? -1 : 1; // left or right
      const angleRad = (angleDeg * Math.PI) / 180;

      // Travel distance in viewport units (roughly diagonal across)
      const distance = 60 + Math.random() * 30; // vh units

      // End position
      const endX = startX + direction * distance * Math.cos(angleRad);
      const endY = startY + distance * Math.sin(angleRad);

      // CSS rotation angle (the streak should point in direction of motion)
      // atan2 of motion vector. CSS rotates clockwise from +x axis.
      const cssAngle =
        (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

      const meteor: Meteor = {
        id: Date.now() + Math.random(),
        startX,
        startY,
        endX,
        endY,
        cssAngle,
        duration: 1.2 + Math.random() * 0.8, // 1.2-2.0 seconds
      };

      setMeteors((prev) => [...prev, meteor]);

      // Remove after animation completes
      setTimeout(() => {
        setMeteors((prev) => prev.filter((m) => m.id !== meteor.id));
      }, meteor.duration * 1000 + 100);

      // Schedule next meteor (random interval)
      const nextDelay = 4000 + Math.random() * 12000; // 4-16 seconds
      setTimeout(spawn, nextDelay);
    };

    // Start the first meteor after a short delay
    const initialDelay = setTimeout(spawn, 2000);

    return () => {
      active = false;
      clearTimeout(initialDelay);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-1000 z-0 overflow-hidden"
    >
      {/* Static twinkling stars */}
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 2}px rgba(255, 255, 255, 0.5)`,
          }}
        />
      ))}

      {/* Active meteors */}
      {meteors.map((m) => (
        <MeteorStreak key={m.id} meteor={m} />
      ))}
    </div>
  );
}

type Meteor = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cssAngle: number;
  duration: number;
};

function MeteorStreak({ meteor }: { meteor: Meteor }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${meteor.startX}vw`,
        top: `${meteor.startY}vh`,
        transform: `rotate(${meteor.cssAngle}deg)`,
        transformOrigin: "left center",
        animation: `meteorFly ${meteor.duration}s ease-out forwards`,
        // Pass end position as CSS custom properties
        ["--end-x" as string]: `${meteor.endX - meteor.startX}vw`,
        ["--end-y" as string]: `${meteor.endY - meteor.startY}vh`,
      }}
    >
      {/* Tail: a gradient that grows from 0 to full length, then shrinks */}
      <div
        className="h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(255,255,255,0.4))",
          boxShadow: "0 0 4px rgba(255,255,255,0.6)",
          animation: `meteorTail ${meteor.duration}s ease-out forwards`,
        }}
      />
    </div>
  );
}

function PointCloudSVG() {
  const dots: { cx: number; cy: number; r: number; opacity: number; delay: number }[] = [];
  const gridSize = 18;
  const spacing = 22;
  const offsetX = 200 - (gridSize * spacing) / 2;
  const offsetY = 200 - (gridSize * spacing) / 2;
  const centerX = 200;
  const centerY = 200;
  const sphereRadius = 150;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = offsetX + i * spacing;
      const y = offsetY + j * spacing;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < sphereRadius) {
        const opacity = 0.15 + 0.85 * (1 - dist / sphereRadius);
        const r = 1 + 1.5 * (1 - dist / sphereRadius);
        // Stagger pulse delay based on position so dots don't pulse in sync
        const delay = ((dx + dy + 200) / 400) * 3;
        dots.push({ cx: x, cy: y, r, opacity, delay });
      }
    }
  }

  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full max-w-md"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring */}
      <circle
        cx="200"
        cy="200"
        r="170"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-slate-300 dark:text-slate-700"
        strokeDasharray="2 4"
      />
      {/* Crosshair */}
      <line x1="30" y1="200" x2="370" y2="200" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />
      <line x1="200" y1="30" x2="200" y2="370" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />

      {/* Sweep arc */}
      <g className="sweep-line">
        <defs>
          <linearGradient id="sweepGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" className="text-teal-500" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" className="text-teal-500" />
          </linearGradient>
        </defs>
        <path
          d="M 200 200 L 370 200 A 170 170 0 0 0 320 80 Z"
          fill="url(#sweepGrad)"
          opacity="0.3"
        />
      </g>

      {/* Point cloud dots, each pulsing on its own staggered delay */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill="currentColor"
          className="text-teal-600 dark:text-teal-400"
          style={{
            "--start-opacity": d.opacity.toString(),
            "--end-opacity": (d.opacity * 0.4).toString(),
            animation: `pulseDot 3s ease-in-out ${d.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

function ProjectCard({
  slug,
  title,
  description,
  tags,
}: {
  slug: string;
  title: string;
  description: string;
  tags: string[];
}) {
  return (
    <Link
      href={`/projects/${slug}`}
      className="group block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-lg transition-all duration-300"
    >
      {/* Placeholder image area */}
      <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded mb-4 flex items-center justify-center">
        <span className="text-3xl text-slate-400 dark:text-slate-600 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
          →
        </span>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rameunded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}