// All portfolio content lives here. Replace the placeholder values with your own
// data; the page renders entirely from this file, and the build uses `site` for
// the page title, search/social previews, sitemap and robots.txt.

export const site = {
  url: "https://umerjaved.dev", // your final domain, no trailing slash
  title: "Umer Javed — Staff Android Engineer & Generative AI Architect",
  description: "Staff Android Engineer and AI Systems Architect with 8+ years experience building high-performance mobile apps, on-device ML, and production multi-agent systems for international clients.",
  privacyUrl: "", // link to your privacy policy; hidden while empty
  legalUrl: "", // link to your legal notice / imprint; hidden while empty
};

export const profile = {
  firstName: "Umer",
  lastName: "Javed",
  // The hero label cycles through these.
  roles: [
    "Android & AI Engineer",
    "Kotlin & Compose Dev",
    "Agentic AI Architect",
    "LLM & RAG Specialist",
  ],
  tagline: "Engineering high-performance Android applications, on-device ML models, and production agentic AI systems for global enterprises and fast-growing startups.",
  location: "Pakistan (UTC+5)",
  timezoneLabel: "PKT • UTC+5 (Full overlap with US, UK & European business hours)",
  availability: "Available for International Contracts & Consulting",
  bio: "Senior Android Engineer & AI Architect with 8+ years building robust mobile architectures, on-device intelligence, and autonomous agent workflows that scale to millions of users.",
  stats: [
    { value: 8, suffix: "+", label: "Years Experience", detail: "Mobile & AI Engineering" },
    { value: 1, suffix: "M+", label: "Global Installs", detail: "Production Apps on Google Play" },
    { value: 15, suffix: "+", label: "Shipped Projects", detail: "High-Performance Architectures" },
    { value: 100, suffix: "%", label: "On-Time Delivery", detail: "International Remote Track Record" },
  ],
  skills: [
    "Kotlin & Jetpack Compose",
    "Android SDK & Clean Architecture",
    "Generative AI & LLM Integration",
    "Agentic AI, Tool-Calling & MCP",
    "RAG Pipelines & Vector Search",
    "On-Device ML & Performance",
    "Cross-Functional Team Leadership",
  ],
  email: "umer.javed@terafort.org",
  // Shown as round icon buttons in the contact section, after an email button.
  // icon: "github" | "linkedin" | "x" | "playstore" | "link"
  socials: [
    { label: "GitHub", icon: "github", url: "https://github.com/umerjaved" },
    { label: "LinkedIn", icon: "linkedin", url: "https://linkedin.com/in/umerjaved" },
    { label: "Google Play", icon: "playstore", url: "https://play.google.com/store/apps" },
    { label: "X", icon: "x", url: "https://x.com/umerjaved" },
  ],
};

// Common tag colours, so the same technology looks the same on every project.
export const TAG = {
  kotlin: { label: "Kotlin", color: "#7f52ff" },
  compose: { label: "Jetpack Compose", color: "#2f8f5b" },
  android: { label: "Android SDK", color: "#3ddc84", ink: "#06210f" },
  claude: { label: "Claude API", color: "#d97757" },
  rag: { label: "RAG & Vector", color: "#c2410c" },
  mcp: { label: "Model Context Protocol", color: "#2563eb" },
  agents: { label: "Multi-Agent AI", color: "#7c3aed" },
  ml: { label: "On-Device ML", color: "#0891b2" },
  ci: { label: "CI/CD & DevOps", color: "#475569" },
};

// Each project gets a card on the home page and its own page at /project/<slug>.
//   cover:    optional image path for the card (16:10), e.g. "/images/pocket.webp"
//   theme:    background colour of the project page
//   category: "all" | "android" | "ai" | "tools" (used for project filter tabs)
//   metric:   key highlight shown on the card (e.g. "1M+ Installs", "Production AI")
//   gallery:  screenshots shown on the project page; `image` is optional
export const projects = [
  {
    slug: "pocket-assistant",
    title: "Pocket Assistant",
    subtitle: "AI chat app with voice & personal knowledge base",
    category: "ai",
    metric: "Production AI",
    colors: ["#7b5cff", "#c4a8ff"],
    cover: null,
    theme: "#1d1a3d",
    tags: [TAG.kotlin, TAG.compose, TAG.claude, TAG.rag],
    description: [
      "Pocket Assistant is an enterprise-grade Android chat companion with streaming tokens, low-latency voice input, and contextual retrieval over private personal notes.",
      "Led end-to-end delivery from architecture to Google Play Store launch: declarative Jetpack Compose UI, reactive coroutines pipeline, on-device SQLite caching, and local vector retrieval.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "Streaming AI Chat Interface" },
      { image: null, caption: "Real-time Voice Input & Audio Waveform" },
      { image: null, caption: "Semantic Notes & Vector Search" },
    ],
  },
  {
    slug: "release-agent",
    title: "Release Agent",
    subtitle: "Autonomous multi-agent release & CI/CD workflow",
    category: "ai",
    metric: "Autonomous MCP",
    colors: ["#1fa3ff", "#7ee0ff"],
    cover: null,
    theme: "#0f2a44",
    tags: [TAG.mcp, TAG.claude, TAG.ci, TAG.agents],
    description: [
      "An intelligent release automation agent that drafts semantic release notes, monitors Crashlytics dashboards, coordinates Play Console staged rollouts, and requests human confirmation for sensitive actions.",
      "Architected using Model Context Protocol (MCP) servers integrating GitHub APIs, Firebase Crashlytics, and Google Play Publishing APIs.",
    ],
    liveUrl: "https://github.com/",
    gallery: [
      { image: null, caption: "Multi-Agent Rollout Plan" },
      { image: null, caption: "Human-in-the-Loop Approval Modal" },
    ],
  },
  {
    slug: "photo-editor-pro",
    title: "Photo Editor Pro",
    subtitle: "GPU filter pipeline & on-device background segmentation",
    category: "android",
    metric: "1M+ Installs",
    colors: ["#ff8a3d", "#ffd166"],
    cover: null,
    theme: "#3a2414",
    tags: [TAG.kotlin, TAG.compose, TAG.ml, TAG.android],
    description: [
      "High-performance photo editing suite featuring custom OpenGL/Vulkan GPU shaders and real-time on-device neural background segmentation.",
      "Achieved over 1,000,000+ downloads with a 4.6-star rating across international markets through aggressive memory optimization and 60fps render pipelines.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "GPU Filter Studio" },
      { image: null, caption: "AI Semantic Background Removal" },
      { image: null, caption: "Real-Time Histogram & Adjustments" },
    ],
  },
  {
    slug: "support-crew",
    title: "Support Crew",
    subtitle: "Multi-agent collaborative ticket triage & resolution",
    category: "ai",
    metric: "Multi-Agent RAG",
    colors: ["#0f9d58", "#5be49b"],
    cover: null,
    theme: "#102e22",
    tags: [TAG.agents, TAG.claude, TAG.rag],
    description: [
      "A triad of cooperating specialized agents that triage incoming customer tickets, verify customer account states via secure APIs, and generate cited draft responses for support team approval.",
      "Reduced median first-response time by 72% while maintaining strict data isolation and citation verification.",
    ],
    liveUrl: "https://github.com/",
    gallery: [
      { image: null, caption: "Intelligent Triage Dispatcher" },
      { image: null, caption: "Contextual Draft Reply with Citations" },
    ],
  },
  {
    slug: "smart-keyboard",
    title: "Smart Keyboard",
    subtitle: "On-device neural next-phrase prediction engine",
    category: "android",
    metric: "On-Device ML",
    colors: ["#ff5c8a", "#ffb3c7"],
    cover: null,
    theme: "#3a1424",
    tags: [TAG.kotlin, TAG.android, TAG.ml],
    description: [
      "Custom Android Input Method Editor (IME) featuring low-latency on-device phrase predictions via quantized TensorFlow Lite models, with an optional cloud generative rewrite mode.",
      "Designed with zero-permission privacy architecture ensuring user keystrokes never leave the client device.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "On-Device Predictive Completion" },
      { image: null, caption: "Tone & Style Rewrite Assistant" },
    ],
  },
];
