// Static blog generator for the Velox House marketing site.
//
// Runs after `vite build`. Reads markdown posts from content/blog/*.md and writes
// fully static HTML into dist/blog/ so search engines and AI crawlers (which don't
// execute the SPA's JavaScript) see complete pages. Also (re)generates:
//   - dist/blog/index.html   — the blog landing page
//   - dist/blog/rss.xml      — RSS feed
//   - dist/sitemap.xml       — sitemap covering SPA routes + every post
//
// Post frontmatter (--- delimited, `key: value` lines):
//   title, description, date (YYYY-MM-DD), updated (optional), category,
//   author (optional, default "Velox House Team")
//
// A `## Frequently asked questions` section with `### Question?` subheadings is
// automatically emitted as FAQPage JSON-LD in addition to the visible HTML.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const DIST = path.join(ROOT, "dist");
const SITE = "https://veloxhouse.co.uk";
const SIGNUP = "https://hub.veloxhouse.co.uk/signup";

marked.setOptions({ gfm: true });

// ---------------------------------------------------------------- helpers

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    // Strip optional YAML-style surrounding quotes.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[line.slice(0, i).trim()] = v;
  }
  for (const k of ["title", "description", "date", "category"]) {
    if (!meta[k]) throw new Error(`${file}: frontmatter missing "${k}"`);
  }
  return { meta, body: m[2] };
}

// Pull `### Question` + following text out of the FAQ section for JSON-LD.
function extractFaq(markdown) {
  const sec = markdown.match(/^## Frequently asked questions\s*$([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  if (!sec) return [];
  const out = [];
  const parts = sec[1].split(/^### /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    if (nl === -1) continue;
    const q = p.slice(0, nl).trim();
    const a = p
      .slice(nl)
      .trim()
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // strip links
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ");
    if (q && a) out.push({ q, a });
  }
  return out;
}

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const readingTime = (markdown) =>
  Math.max(2, Math.round(markdown.split(/\s+/).length / 220));

// ---------------------------------------------------------------- chrome

const STYLE = `
:root{color-scheme:dark}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0A0A0A;color:#E5E5E5;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.7}
a{color:inherit}
.nav{position:sticky;top:0;z-index:50;border-bottom:1px solid #1A1A1A;background:rgba(10,10,10,.88);backdrop-filter:blur(16px)}
.nav-in{max-width:1120px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-links{display:flex;gap:28px;align-items:center}
.nav-links a{font-size:14px;color:#A0A0A0;text-decoration:none;transition:color .15s}
.nav-links a:hover,.nav-links a.on{color:#fff}
.cta-btn{background:#DA291C;color:#fff!important;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:500;text-decoration:none;transition:background .15s;white-space:nowrap}
.cta-btn:hover{background:#FF3B2D}
.logo img{height:30px;display:block}
main{max-width:760px;margin:0 auto;padding:56px 24px 80px}
.crumbs{font-size:13px;color:#777;margin-bottom:28px}
.crumbs a{color:#777;text-decoration:none}
.crumbs a:hover{color:#fff}
.tag{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#FF5A3C;margin-bottom:14px}
h1{font-family:Sora,Inter,sans-serif;font-size:clamp(30px,5vw,44px);font-weight:700;letter-spacing:-.02em;color:#fff;line-height:1.15;margin-bottom:18px}
.byline{display:flex;gap:10px;flex-wrap:wrap;font-size:14px;color:#888;margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid #1A1A1A}
.article h2{font-family:Sora,Inter,sans-serif;font-size:26px;font-weight:700;letter-spacing:-.01em;color:#fff;margin:44px 0 16px}
.article h3{font-family:Sora,Inter,sans-serif;font-size:19px;font-weight:600;color:#fff;margin:32px 0 12px}
.article p{margin:0 0 18px;color:#C9C9C9}
.article a{color:#FF5A3C;text-decoration:underline;text-decoration-color:rgba(255,90,60,.4);text-underline-offset:3px}
.article a:hover{text-decoration-color:#FF5A3C}
.article ul,.article ol{margin:0 0 18px 22px;color:#C9C9C9}
.article li{margin-bottom:8px}
.article strong{color:#fff}
.article blockquote{border-left:3px solid #DA291C;padding:4px 0 4px 18px;margin:0 0 18px;color:#A0A0A0;font-style:italic}
.article code{background:#161616;border:1px solid #222;border-radius:5px;padding:1px 6px;font-size:.9em}
.article table{width:100%;border-collapse:collapse;margin:8px 0 24px;font-size:14.5px;display:block;overflow-x:auto}
.article th{white-space:nowrap;text-align:left;color:#fff;font-weight:600;border-bottom:1px solid #333;padding:10px 14px 10px 0}
.article td{border-bottom:1px solid #1A1A1A;padding:10px 14px 10px 0;vertical-align:top;color:#C9C9C9}
.cta-box{margin:44px 0;border:1px solid #2A2A2A;border-radius:16px;padding:28px;background:linear-gradient(140deg,#141414,#191010)}
.cta-box h3{font-family:Sora,Inter,sans-serif;color:#fff;font-size:20px;margin-bottom:8px}
.cta-box p{color:#A0A0A0;font-size:15px;margin-bottom:18px}
.related{max-width:1120px;margin:0 auto;padding:0 24px 72px}
.related h2{font-family:Sora,Inter,sans-serif;color:#fff;font-size:22px;margin-bottom:20px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.card{display:block;border:1px solid #1A1A1A;border-radius:14px;padding:22px;background:#111;text-decoration:none;transition:border-color .15s}
.card:hover{border-color:#3A3A3A}
.card .tag{margin-bottom:10px}
.card h3{font-family:Sora,Inter,sans-serif;color:#fff;font-size:17px;line-height:1.35;margin-bottom:8px}
.card p{color:#999;font-size:14px;line-height:1.55}
.card .when{margin-top:14px;font-size:12.5px;color:#666}
footer{border-top:1px solid #1A1A1A;padding:36px 24px;text-align:center;font-size:13px;color:#666}
footer a{color:#888;text-decoration:none;margin:0 10px}
footer a:hover{color:#fff}
.hero{max-width:1120px;margin:0 auto;padding:72px 24px 40px}
.hero h1{max-width:640px}
.hero p{color:#A0A0A0;max-width:560px;font-size:17px}
@media(max-width:720px){.nav-links{display:none}}
`;

const nav = () => `
<header class="nav"><div class="nav-in">
  <a class="logo" href="/" aria-label="Velox House home"><img src="/velox-lockup-dark.png" alt="Velox House" /></a>
  <nav class="nav-links">
    <a href="/features">Features</a>
    <a href="/#pricing">Pricing</a>
    <a class="on" href="/blog/">Blog</a>
    <a href="/tools">Free email check</a>
  </nav>
  <a class="cta-btn" href="${SIGNUP}">Start free trial</a>
</div></header>`;

const footer = () => `
<footer>
  <div>
    <a href="/">Home</a><a href="/features">Features</a><a href="/blog/">Blog</a>
    <a href="/tools">Free email check</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a>
  </div>
  <div style="margin-top:14px">© ${new Date().getFullYear()} Velox House. AI outreach from a single prompt — built for ambitious UK businesses.</div>
</footer>`;

const ctaBox = () => `
<div class="cta-box">
  <h3>Put your outbound on autopilot</h3>
  <p>Describe your ideal customer in one prompt. Velox AI finds the leads, verifies their emails, writes personalised email + LinkedIn messages, and sends every day from your own inbox. Plans from £19.99/mo.</p>
  <a class="cta-btn" href="${SIGNUP}">Start your 21-day free trial</a>
</div>`;

const head = ({ title, description, url, ogType = "article", jsonld }) => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#E8202A" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="Velox House" />
<meta property="og:locale" content="en_GB" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${SITE}/og-image.png" />
<link rel="alternate" type="application/rss+xml" title="Velox House Blog" href="${SITE}/blog/rss.xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;600;700&display=swap" rel="stylesheet" />
${jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
<style>${STYLE}</style>
</head>`;

// ---------------------------------------------------------------- build

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).sort();
const posts = files.map((f) => {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
  const { meta, body } = parseFrontmatter(raw, f);
  const slug = f.replace(/\.md$/, "");
  return {
    slug,
    url: `${SITE}/blog/${slug}/`,
    ...meta,
    author: meta.author || "Velox House Team",
    faq: extractFaq(body),
    mins: readingTime(body),
    html: marked.parse(body),
    body,
  };
});
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

for (const post of posts) {
  const related = posts
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.category === post.category ? -1 : 1) - (b.category === post.category ? -1 : 1))
    .slice(0, 3);

  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      author: { "@type": "Organization", name: post.author, url: SITE },
      publisher: {
        "@type": "Organization",
        name: "Velox House",
        url: SITE,
        logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` },
      },
      image: `${SITE}/og-image.png`,
      mainEntityOfPage: post.url,
      url: post.url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog/` },
        { "@type": "ListItem", position: 3, name: post.title, item: post.url },
      ],
    },
  ];
  if (post.faq.length) {
    jsonld.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
  }

  // Insert the CTA box roughly mid-article (before the 4th h2) and at the end.
  let html = post.html;
  const h2s = [...html.matchAll(/<h2/g)];
  if (h2s.length >= 5) {
    const at = h2s[3].index;
    html = html.slice(0, at) + ctaBox() + html.slice(at);
  }

  const page = `${head({ title: `${post.title} | Velox House Blog`, description: post.description, url: post.url, jsonld })}
<body>
${nav()}
<main>
  <nav class="crumbs"><a href="/">Home</a> › <a href="/blog/">Blog</a> › ${esc(post.title)}</nav>
  <span class="tag">${esc(post.category)}</span>
  <h1>${esc(post.title)}</h1>
  <div class="byline">
    <span>${esc(post.author)}</span><span>·</span>
    <time datetime="${post.date}">${fmtDate(post.date)}</time>
    ${post.updated ? `<span>·</span><span>Updated <time datetime="${post.updated}">${fmtDate(post.updated)}</time></span>` : ""}
    <span>·</span><span>${post.mins} min read</span>
  </div>
  <article class="article">
    ${html}
    ${ctaBox()}
  </article>
</main>
<section class="related">
  <h2>Keep reading</h2>
  <div class="cards">
    ${related
      .map(
        (r) => `<a class="card" href="/blog/${r.slug}/">
      <span class="tag">${esc(r.category)}</span>
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.description)}</p>
      <span class="when">${fmtDate(r.date)} · ${r.mins} min read</span>
    </a>`
      )
      .join("\n")}
  </div>
</section>
${footer()}
</body>
</html>`;

  const dir = path.join(DIST, "blog", post.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page);
}

// ------------------------------------------------------- blog index page

const indexJsonld = [
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE}/blog/#blog`,
    name: "Velox House Blog",
    description:
      "Practical guides on cold email, LinkedIn outreach, deliverability and AI-powered B2B lead generation.",
    url: `${SITE}/blog/`,
    publisher: { "@type": "Organization", name: "Velox House", url: SITE },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: p.url,
      datePublished: p.date,
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog/` },
    ],
  },
];

const indexPage = `${head({
  title: "Blog — Cold Email, LinkedIn Outreach & AI Lead Generation Guides | Velox House",
  description:
    "Practical, up-to-date guides on cold email deliverability, UK outreach law, LinkedIn automation, AI SDRs and B2B lead generation — from the team behind Velox House.",
  url: `${SITE}/blog/`,
  ogType: "website",
  jsonld: indexJsonld,
})}
<body>
${nav()}
<div class="hero">
  <span class="tag">Velox House Blog</span>
  <h1>Outbound that actually lands.</h1>
  <p>Practical guides on cold email, deliverability, LinkedIn outreach and AI-powered lead generation — written by the team building Velox House.</p>
</div>
<section class="related" style="padding-top:8px">
  <div class="cards">
    ${posts
      .map(
        (p) => `<a class="card" href="/blog/${p.slug}/">
      <span class="tag">${esc(p.category)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      <span class="when">${fmtDate(p.date)} · ${p.mins} min read</span>
    </a>`
      )
      .join("\n")}
  </div>
</section>
${footer()}
</body>
</html>`;

fs.mkdirSync(path.join(DIST, "blog"), { recursive: true });
fs.writeFileSync(path.join(DIST, "blog", "index.html"), indexPage);

// ----------------------------------------------------------------- RSS

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Velox House Blog</title>
  <link>${SITE}/blog/</link>
  <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
  <description>Practical guides on cold email, LinkedIn outreach, deliverability and AI-powered B2B lead generation.</description>
  <language>en-gb</language>
${posts
  .map(
    (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${p.url}</link>
    <guid isPermaLink="true">${p.url}</guid>
    <pubDate>${new Date(p.date + "T09:00:00Z").toUTCString()}</pubDate>
    <description>${esc(p.description)}</description>
  </item>`
  )
  .join("\n")}
</channel>
</rss>
`;
fs.writeFileSync(path.join(DIST, "blog", "rss.xml"), rss);

// -------------------------------------------------------------- sitemap

const today = new Date().toISOString().slice(0, 10);
const staticRoutes = [
  { loc: `${SITE}/`, lastmod: today, changefreq: "weekly", priority: "1.0" },
  { loc: `${SITE}/features`, lastmod: today, changefreq: "monthly", priority: "0.9" },
  { loc: `${SITE}/blog/`, lastmod: posts[0]?.date || today, changefreq: "weekly", priority: "0.9" },
  { loc: `${SITE}/tools`, lastmod: today, changefreq: "monthly", priority: "0.7" },
  { loc: `${SITE}/legal/privacy`, lastmod: "2026-07-05", changefreq: "yearly", priority: "0.2" },
  { loc: `${SITE}/legal/cookies`, lastmod: "2026-07-05", changefreq: "yearly", priority: "0.2" },
  { loc: `${SITE}/legal/terms`, lastmod: "2026-07-05", changefreq: "yearly", priority: "0.2" },
];
const postRoutes = posts.map((p) => ({
  loc: p.url,
  lastmod: p.updated || p.date,
  changefreq: "monthly",
  priority: "0.8",
}));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticRoutes, ...postRoutes]
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);

console.log(`blog: built ${posts.length} posts, index, rss.xml and sitemap.xml (${staticRoutes.length + postRoutes.length} urls)`);
