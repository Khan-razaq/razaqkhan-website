export type ProjectStatus = "live" | "in-progress" | "planned";

export type ProjectVisual = {
  src: string; // path to image in /public/projects/
  alt: string;
  caption?: string;
};

export type Project = {
  slug: string;
  title: string;
  oneLine: string; // short description for cards
  status: ProjectStatus;
  tags: string[];

  outcome?: string; // top of inverted pyramid: what it is, performance, contribution
  motivation?: string; // why it matters
  skills?: string[]; // strong action verbs: "designed", "built", "analyzed"
  technical?: string; // longer technical details for curious readers
  visuals?: ProjectVisual[];

  githubUrl?: string;
  liveUrl?: string;
};

export const projects: Project[] = [
  {
    slug: "finance-dashboard",
    title: "Personal Finance Dashboard with Auto-Recommendation Engine",
    oneLine: "Full-stack app for tracking expenses, loans, and savings — with a math engine that recommends monthly allocations.",
    status: "live",
    tags: ["Next.js", "TypeScript", "Supabase", "Tailwind"],

    outcome: "A live, authenticated full-stack web app that ingests income, fixed expenses, credit cards, and loans, then runs a recommendation engine to suggest optimal monthly payment allocations. Features a strategy comparison banner that shows the trade-off between paying loans in parallel vs. avalanche (e.g. avalanche saves 16 months and $4,443 in interest, but uncles wait 18 months for first payment). Used daily for real financial decisions on a $44K student loan and personal cash flow.",

    motivation: "Personal finance apps default to interest-bearing optimization (always pay the highest-interest loan first). For someone with values around Islamic finance (avoiding riba) and family loans, that math is wrong — uncle loans at 0% would never get paid back in pure-math mode. I needed a tool that respected both math and human values, with an explicit 'force include' flag per loan and overridable recommendations.",

    skills: [
      "Architected a Next.js + Supabase stack with RLS-secured data per user",
      "Designed a month-by-month loan simulation engine handling compound interest, moratoriums, and zero-interest edge cases",
      "Built a recommendation algorithm that respects user-flagged loans before sending surplus to highest-interest debts",
      "Implemented a strategy comparison engine: parallel vs. avalanche payoff with full interest accounting",
      "Verified all financial math against console-logged real numbers before deploying",
    ],

    technical: "The math engine is the centerpiece. `simulateLoanPayoff` runs month-by-month: applies interest at the monthly rate, subtracts EMI + extra payment, detects edge cases like 'payment doesn't cover interest' and reports 'balance grows forever' rather than silently looping. `simulateBudgetMode` handles cascade — when one loan finishes, its monthly budget slice automatically reallocates to the next priority. The recommendation algorithm pulls force-included loans first (their balance divided by target months), then routes the surplus to the highest-interest interest-bearing loan. All amounts handled in USD using a user-controlled INR/USD rate so the loan in rupees is comparable to the loans in dollars.",

    visuals: [],

    githubUrl: "https://github.com/Khan-razaq/razaqkhan-website",
  },

  {
    slug: "point-cloud-elevation",
    title: "Point Cloud Elevation Mapping",
    oneLine: "Real-time terrain reconstruction from depth sensors for off-road navigation.",
    status: "in-progress",
    tags: ["ROS2", "PCL", "C++", "RealSense"],
  },

  {
    slug: "waste-classification",
    title: "Real-Time Waste Classification",
    oneLine: "Camera-based perception system that identifies waste categories (plastic, biodegradable, aluminum) for sorting.",
    status: "in-progress",
    tags: ["PyTorch", "OpenCV", "Python"],
  },

  {
    slug: "deepfake-detection",
    title: "Live Deepfake Detection Pipeline",
    oneLine: "Video and live-camera perception system detecting face manipulation in real-time.",
    status: "in-progress",
    tags: ["PyTorch", "OpenCV", "Python"],
  },
];