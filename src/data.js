// All portfolio content lives here. Replace the placeholder values with your own
// data; the page renders entirely from this file, and the build uses `site` for
// the page title, search/social previews, sitemap and robots.txt.

export const site = {
  url: "https://example.com", // your final domain, no trailing slash
  title: "Your Name — Android Developer, Team Lead & AI Engineer",
  description: "Android developer and team lead building generative AI features and agentic systems.",
  privacyUrl: "", // link to your privacy policy; hidden while empty
  legalUrl: "", // link to your legal notice / imprint; hidden while empty
};

export const profile = {
  firstName: "Your",
  lastName: "Name",
  // The hero label cycles through these.
  roles: ["Android Developer", "Team Lead", "Generative AI", "Agentic AI"],
  location: "Pakistan",
  bio: "Builds Android apps and AI agents that are fast, reliable, and actually useful.",
  skills: [
    "Kotlin & Jetpack Compose",
    "Android SDK & Play Store",
    "Team Leadership",
    "Generative AI & RAG",
    "Agentic AI & MCP",
  ],
  email: "you@example.com",
  // Shown as round icon buttons in the contact section, after an email button.
  // icon: "github" | "linkedin" | "x" | "playstore" | "link"
  socials: [
    { label: "GitHub", icon: "github", url: "https://github.com/" },
    { label: "LinkedIn", icon: "linkedin", url: "https://www.linkedin.com/" },
    { label: "Google Play", icon: "playstore", url: "https://play.google.com/store" },
    { label: "X", icon: "x", url: "https://x.com/" },
  ],
};

// Common tag colours, so the same technology looks the same on every project.
const TAG = {
  kotlin: { label: "Kotlin", color: "#7f52ff" },
  compose: { label: "Jetpack Compose", color: "#2f8f5b" },
  android: { label: "Android", color: "#3ddc84", ink: "#06210f" },
  claude: { label: "Claude API", color: "#d97757" },
  rag: { label: "RAG", color: "#c2410c" },
  mcp: { label: "MCP", color: "#2563eb" },
  agents: { label: "Multi-agent", color: "#7c3aed" },
  ml: { label: "On-device ML", color: "#0891b2" },
  ci: { label: "CI/CD", color: "#475569" },
};

// Each project gets a card on the home page and its own page at /project/<slug>.
//   cover:   optional image path for the card (16:10), e.g. "/images/pocket.webp"
//   theme:   background colour of the project page
//   gallery: screenshots shown on the project page; `image` is optional, a
//            generated placeholder with the caption is shown until you add one
export const projects = [
  {
    slug: "pocket-assistant",
    title: "Pocket Assistant",
    subtitle: "AI chat app for Android",
    colors: ["#7b5cff", "#c4a8ff"],
    cover: null,
    theme: "#1d1a3d",
    tags: [TAG.kotlin, TAG.compose, TAG.claude, TAG.rag],
    description: [
      "Pocket Assistant is an Android chat assistant with streaming answers, voice input and retrieval over the user's own notes.",
      "I led the app from prototype to Play Store: the Compose UI, the streaming client, on-device caching and the retrieval pipeline.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "Chat" },
      { image: null, caption: "Voice input" },
      { image: null, caption: "Notes search" },
    ],
  },
  {
    slug: "release-agent",
    title: "Release Agent",
    subtitle: "Agent that ships app releases",
    colors: ["#1fa3ff", "#7ee0ff"],
    cover: null,
    theme: "#0f2a44",
    tags: [TAG.mcp, TAG.claude, TAG.ci],
    description: [
      "An agent that drafts release notes, checks crash dashboards and prepares the staged rollout, then waits for a human to approve.",
      "Built on tool calling and MCP servers for GitHub, Crashlytics and the Play Console.",
    ],
    liveUrl: "",
    gallery: [
      { image: null, caption: "Release plan" },
      { image: null, caption: "Approval step" },
    ],
  },
  {
    slug: "photo-editor-pro",
    title: "Photo Editor Pro",
    subtitle: "Compose photo editor · 1M+ installs",
    colors: ["#ff8a3d", "#ffd166"],
    cover: null,
    theme: "#3a2414",
    tags: [TAG.kotlin, TAG.compose, TAG.ml],
    description: [
      "A photo editor with GPU filters and on-device background removal, used by over a million people.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "Editor" },
      { image: null, caption: "Background removal" },
      { image: null, caption: "Filters" },
    ],
  },
  {
    slug: "support-crew",
    title: "Support Crew",
    subtitle: "Multi-agent support triage",
    colors: ["#0f9d58", "#5be49b"],
    cover: null,
    theme: "#102e22",
    tags: [TAG.agents, TAG.claude, TAG.rag],
    description: [
      "Three cooperating agents classify support tickets, look up order data and draft replies with citations for a human to send.",
    ],
    liveUrl: "",
    gallery: [
      { image: null, caption: "Triage board" },
      { image: null, caption: "Draft reply" },
    ],
  },
  {
    slug: "smart-keyboard",
    title: "Smart Keyboard",
    subtitle: "On-device AI keyboard",
    colors: ["#ff5c8a", "#ffb3c7"],
    cover: null,
    theme: "#3a1424",
    tags: [TAG.kotlin, TAG.android, TAG.ml],
    description: [
      "A keyboard with on-device next-phrase suggestions and an optional cloud rewrite mode.",
    ],
    liveUrl: "https://play.google.com/store",
    gallery: [
      { image: null, caption: "Suggestions" },
      { image: null, caption: "Rewrite mode" },
    ],
  },
];
