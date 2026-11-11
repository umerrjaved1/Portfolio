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
  // "Hire me" section. bookingUrl: a Calendly / Cal.com link; while empty the main
  // button opens a pre-filled email instead.
  hire: {
    status: "Available for new projects",
    lede: "Android apps, on-device AI or agentic systems: tell me what you're building and I'll reply with a plan, a timeline and an honest estimate.",
    timeZone: "Asia/Karachi",
    responseTime: "Replies within 24 hours",
    bookingUrl: "",
    modes: ["Full-time remote", "Contract", "Consulting", "Tech advisory"],
    // Looping chat on the phone mockup. from: "client" | "me"
    chat: [
      { from: "client", text: "Hi! We need an Android app with built-in AI. Can you help?" },
      { from: "me", text: "Definitely. Kotlin + Jetpack Compose, with an on-device model so it works offline and stays private." },
      { from: "client", text: "Nice. How fast can we launch?" },
      { from: "me", text: "MVP in about 6 weeks. Want to jump on a quick call to scope it?" },
      { from: "client", text: "Let's do it! 🚀" },
    ],
    services: ["Android apps", "Jetpack Compose", "On-device ML", "LLM integration", "RAG pipelines", "AI agents & MCP", "App performance", "Architecture reviews"],
  },
  // Shown as round icon buttons in the contact section, after an email button.
  // icon: "github" | "linkedin" | "x" | "playstore" | "link"
  socials: [
    { label: "GitHub", icon: "github", url: "https://github.com/umerjaved" },
    { label: "LinkedIn", icon: "linkedin", url: "https://linkedin.com/in/umerjaved" },
    { label: "Google Play", icon: "playstore", url: "https://play.google.com/store/apps" },
    { label: "X", icon: "x", url: "https://x.com/umerjaved" },
  ],
};

// Common tag colours, so the same kind of work looks the same on every project.
export const TAG = {
  android: { label: "Android", color: "#3ddc84", ink: "#06210f" },
  genAI: { label: "Generative AI", color: "#5b5bd6" },
  imageAI: { label: "AI Image Editing", color: "#7c3aed" },
  vision: { label: "Computer Vision", color: "#0891b2" },
  audio: { label: "Audio Processing", color: "#d97706" },
  maps: { label: "Maps & GPS", color: "#059669" },
  media: { label: "Media", color: "#db2777" },
  utility: { label: "Utilities", color: "#475569" },
  translate: { label: "Translation", color: "#2563eb" },
};

// Published apps (source: mzalogics-web.vercel.app/work, AI and Android only).
// Each project gets a card on the home page and its own page at /project/<slug>.
//   cover:    card image (16:9), served from /public/images/projects
//   theme:    background colour of the project page
//   category: "ai" | "android"
//   metric:   short label shown on the card
//   gallery:  images shown on the project page
const play = (id) => `https://play.google.com/store/apps/details?id=${id}`;
const img = (slug) => `/images/projects/${slug}.jpg`;

export const projects = [
  {
    slug: "picsgen-ai-art-photo-editor",
    title: "PicsGen: AI Art & Photo Editor",
    subtitle: "AI artwork from text prompts and style references",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#b3123a", "#ff6b81"],
    cover: img("picsgen-ai-art-photo-editor"),
    theme: "#2a0d16",
    tags: [TAG.android, TAG.genAI, TAG.imageAI],
    description: [
      "Turns text prompts and style references into AI artwork, alongside AI portrait features like hair-style changes and future-baby previews.",
      "Includes touch-ups, masking and export in more than one format. Published on Google Play.",
    ],
    liveUrl: play("com.picsgen.ai.art.photo.editor"),
    gallery: [{ image: img("picsgen-ai-art-photo-editor"), caption: "AI art, hair styles and portrait generation" }],
  },
  {
    slug: "beauty-cam-ai-generation",
    title: "Beauty Cam & AI Generation",
    subtitle: "Selfie camera with live beauty filters and AI portraits",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#d14d8b", "#ffb3d1"],
    cover: img("beauty-cam-ai-generation"),
    theme: "#2b1020",
    tags: [TAG.android, TAG.vision, TAG.genAI],
    description: [
      "A selfie camera with portrait generation built in.",
      "Uses facial landmarks and segmentation for live beauty filters and AI-generated backgrounds. Published on Google Play.",
    ],
    liveUrl: play("ai.photo.video.hdcamera.selfie.beauty.cam"),
    gallery: [{ image: img("beauty-cam-ai-generation"), caption: "Live beauty filters and AI portraits" }],
  },
  {
    slug: "ai-tattoo-generator",
    title: "AI Tattoo Generator: Tattoome",
    subtitle: "Generate tattoo designs and preview them on your body",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#1f1f24", "#8a8a96"],
    cover: img("ai-tattoo-generator"),
    theme: "#141418",
    tags: [TAG.android, TAG.genAI, TAG.vision],
    description: [
      "Generates tattoo designs with AI and previews them before you commit.",
      "Uses subject segmentation, body-contour blending and live AR for realistic previews. Published on Google Play.",
    ],
    liveUrl: play("tattoome.ai.tattoogenerator"),
    gallery: [{ image: img("ai-tattoo-generator"), caption: "AI tattoo designs with live AR preview" }],
  },
  {
    slug: "pixnova-ai-photo-editor",
    title: "PixNova: AI Art & Photo Editor",
    subtitle: "AI artwork, photo enhancement and background removal",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#4f46e5", "#a5b4fc"],
    cover: img("pixnova-ai-photo-editor"),
    theme: "#15153a",
    tags: [TAG.android, TAG.genAI, TAG.imageAI],
    description: [
      "AI artwork generation, photo enhancement and one-tap background removal in a single editor.",
      "Adds portrait retouching and creative filters. Published on Google Play.",
    ],
    liveUrl: play("ai.art.generated.bgremover.enhancer.photo.editor"),
    gallery: [{ image: img("pixnova-ai-photo-editor"), caption: "AI enhancement and background removal" }],
  },
  {
    slug: "aspireai-art-video-generator",
    title: "AspireAI: Art & Video Generator",
    subtitle: "AI image, video and text creation",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#7c3aed", "#c4b5fd"],
    cover: img("aspireai-art-video-generator"),
    theme: "#1d1238",
    tags: [TAG.android, TAG.genAI, TAG.media],
    description: [
      "Creates AI images, videos and text from one app.",
      "Includes social sharing, a credits system and creator competitions. Published on Google Play.",
    ],
    liveUrl: play("com.aspire.ai.photo.video.hub"),
    gallery: [{ image: img("aspireai-art-video-generator"), caption: "AI image, video and text generation" }],
  },
  {
    slug: "snaptune-ai-photo-editor",
    title: "Snaptune AI Photo Editor",
    subtitle: "AI enhancement, background erase and collages",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#0ea5e9", "#7dd3fc"],
    cover: img("snaptune-ai-photo-editor"),
    theme: "#0c2433",
    tags: [TAG.android, TAG.imageAI],
    description: [
      "AI photo enhancement, background erase and collage making.",
      "Adds frames and creative photo effects. Published on Google Play.",
    ],
    liveUrl: play("com.snaptune.ai.photoeditor.collagemaker"),
    gallery: [{ image: img("snaptune-ai-photo-editor"), caption: "AI enhancement, background erase and collages" }],
  },
  {
    slug: "ai-voice-changer",
    title: "AI Voice Changer & Sound Effects",
    subtitle: "Voice modulation with pitch, reverb and sharing",
    category: "ai",
    metric: "AI app · Google Play",
    colors: ["#f59e0b", "#fcd34d"],
    cover: img("ai-voice-changer"),
    theme: "#2e1f08",
    tags: [TAG.android, TAG.audio],
    description: [
      "Changes your voice with pitch, reverb and sound effects, ready to share.",
      "Includes waveform visualization and audio rendering. Published on Google Play.",
    ],
    liveUrl: play("ai.voice.changer.app"),
    gallery: [{ image: img("ai-voice-changer"), caption: "Voice effects with live waveform" }],
  },
  {
    slug: "live-earth-map",
    title: "Live Earth Map: GPS Satellite",
    subtitle: "Satellite maps, traffic, compass and world clock",
    category: "android",
    metric: "Android · Google Play",
    colors: ["#047857", "#6ee7b7"],
    cover: img("live-earth-map"),
    theme: "#0b2a20",
    tags: [TAG.android, TAG.maps],
    description: [
      "Satellite maps with traffic, a compass, famous places and a world clock.",
      "Adds search, 3D map views and a timestamp camera. Published on Google Play.",
    ],
    liveUrl: play("liveearth.map.satellite.globe.terrain.gps"),
    gallery: [{ image: img("live-earth-map"), caption: "Satellite, 3D and live map views" }],
  },
  {
    slug: "flight-tracker",
    title: "Flight Tracker: Flight Status",
    subtitle: "Live flight status and tracking",
    category: "android",
    metric: "Android · Google Play",
    colors: ["#2563eb", "#93c5fd"],
    cover: img("flight-tracker"),
    theme: "#0f1f3d",
    tags: [TAG.android, TAG.maps],
    description: [
      "Live flight status and real-time tracking.",
      "Combines a flight-status lookup with a live tracker view. Published on Google Play.",
    ],
    liveUrl: play("com.fl.flight.tracker.flightstatus.flight.radar"),
    gallery: [{ image: img("flight-tracker"), caption: "Live flight status and tracking" }],
  },
  {
    slug: "translate-all",
    title: "Translate All: Voice & Photo",
    subtitle: "Translation from text, voice and photos",
    category: "android",
    metric: "Android · Google Play",
    colors: ["#1d4ed8", "#bfdbfe"],
    cover: img("translate-all"),
    theme: "#0f1d3a",
    tags: [TAG.android, TAG.translate, TAG.vision],
    description: [
      "Translates text, speech and photos across languages.",
      "Adds voice input and camera-based photo translation. Published on Google Play.",
    ],
    liveUrl: play("com.tfl.alllanguagestranslator.text.voice.fasttranslation.camera"),
    gallery: [{ image: img("translate-all"), caption: "Text, voice and photo translation" }],
  },
  {
    slug: "data-recovery",
    title: "Data Recovery: Restore Deleted Files",
    subtitle: "Finds deleted photos, video, audio and documents",
    category: "android",
    metric: "Android · Google Play",
    colors: ["#0f766e", "#5eead4"],
    cover: img("data-recovery"),
    theme: "#0c2625",
    tags: [TAG.android, TAG.utility],
    description: [
      "Scans device storage for deleted images, video, audio and documents.",
      "Built on asynchronous indexing and thumbnail caching so large scans stay fast. Published on Google Play.",
    ],
    liveUrl: play("com.filerecovery.photosrecovery.deletedrestore"),
    gallery: [{ image: img("data-recovery"), caption: "Fast scanning and file recovery" }],
  },
  {
    slug: "screen-mirroring-tv",
    title: "Screen Mirroring TV: Miracast",
    subtitle: "Cast your phone screen to a TV",
    category: "android",
    metric: "Android · Google Play",
    colors: ["#334155", "#94a3b8"],
    cover: img("screen-mirroring-tv"),
    theme: "#151c27",
    tags: [TAG.android, TAG.media],
    description: [
      "Casts the phone screen to a TV.",
      "Uses screen mirroring over Miracast. Published on Google Play.",
    ],
    liveUrl: play("com.tas.tv.cast"),
    gallery: [{ image: img("screen-mirroring-tv"), caption: "Phone-to-TV screen mirroring" }],
  },
];
