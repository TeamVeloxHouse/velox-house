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
import { loadEnv } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// This script runs as plain Node, so it doesn't get Vite's import.meta.env — read the
// same .env files Vite just used, so a local production build bakes the same analytics
// config into the static pages as the SPA. Real environment variables win, matching
// Vite's own precedence (and how Cloudflare Builds supplies them).
const ENV = { ...loadEnv("production", ROOT, "VITE_"), ...process.env };
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const DIST = path.join(ROOT, "dist");
const SITE = "https://veloxhouse.co.uk";
const SIGNUP = "https://hub.veloxhouse.co.uk/signup";

// Supabase endpoint for the in-article lead capture. `inbound-lead` is deployed
// public (no JWT verification), so the project URL is enough; the anon key is
// sent only if the build environment happens to provide one. Vite injects these
// into the SPA from import.meta.env — this script is plain Node, so read the CI
// environment and fall back to the local .env the same way `vite build` would.
function envVar(key, fallback = "") {
  if (process.env[key]) return process.env[key];
  try {
    const line = fs
      .readFileSync(path.join(ROOT, ".env"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env — CI provides the vars, or capture stays off */
  }
  return fallback;
}

const SUPABASE_URL = envVar(
  "VITE_SUPABASE_URL",
  "https://qmzfuadxcnweiwbrsutn.supabase.co"
).replace(/\/$/, "");
const SUPABASE_ANON_KEY = envVar("VITE_SUPABASE_ANON_KEY");

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
.lead-box{margin:44px 0;border:1px solid rgba(218,41,28,.35);border-radius:16px;padding:28px;background:linear-gradient(140deg,#121212,#1B0F0E)}
.lead-kicker{display:block;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#FF5A3C;margin-bottom:12px}
.lead-box h3{font-family:Sora,Inter,sans-serif;color:#fff;font-size:21px;line-height:1.25;margin-bottom:8px}
.lead-box p{color:#A0A0A0;font-size:15px;margin-bottom:18px}
.lead-row{display:flex;gap:10px;flex-wrap:wrap}
.lead-row input{flex:1 1 240px;min-width:0;border:1px solid #2A2A2A;background:#141414;border-radius:8px;padding:13px 15px;font:inherit;font-size:15px;color:#fff}
.lead-row input::placeholder{color:#666}
.lead-row input:focus{outline:none;border-color:#DA291C}
.lead-row button{cursor:pointer;border:0;background:#DA291C;color:#fff;border-radius:8px;padding:13px 22px;font:inherit;font-size:15px;font-weight:500;transition:background .15s}
.lead-row button:hover{background:#FF3B2D}
.lead-row button:disabled{opacity:.6;cursor:default}
.lead-note{font-size:12.5px;color:#666;margin:12px 0 0!important}
.lead-note.err{color:#FF5A3C}
.lead-score{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:24px 0 18px}
.lead-score .num{font-family:Sora,Inter,sans-serif;font-size:52px;font-weight:800;line-height:1;color:#fff}
.lead-score .cap{font-size:14px;color:#666;padding-bottom:5px}
.lead-score .badge{font-size:14px;font-weight:600;color:#FF5A3C;border:1px solid rgba(218,41,28,.4);border-radius:6px;padding:2px 9px;margin-bottom:5px}
.lead-check{display:flex;gap:12px;align-items:flex-start;border-bottom:1px solid #1A1A1A;padding:12px 0}
.lead-check:last-of-type{border-bottom:0}
.lead-check span.ok{color:#DA291C}
.lead-check span.no{color:#555}
.lead-check strong{display:block;color:#fff;font-size:14.5px;font-weight:500}
.lead-check em{display:block;color:#777;font-size:13px;font-style:normal;margin-top:2px}
.lead-cta{margin-top:22px;border:1px solid rgba(218,41,28,.3);border-radius:12px;padding:22px;background:#0A0A0A}
.lead-cta h4{font-family:Sora,Inter,sans-serif;color:#fff;font-size:17px;margin-bottom:8px}
.lead-cta p{font-size:14.5px;margin-bottom:16px}
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

// Google Analytics 4 measurement ID, baked in at build time (same env var the SPA
// reads). Unset = GA4 simply off; the first-party analytics still run.
const GA_ID = (ENV.VITE_GA4_ID || "").trim();

// Cloudflare Web Analytics — cookieless, so it counts every visitor rather than only the
// ones who accept cookies. Mirrors src/lib/cf-analytics.ts. Unset = no beacon.
const CF_BEACON = (ENV.VITE_CF_BEACON_TOKEN || "").trim();
const CF_TAG = CF_BEACON
  ? `\n<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: CF_BEACON })}'></script>`
  : "";

// Consent banner + analytics for the static pages. Mirrors the SPA (src/lib/consent.ts,
// track.ts, engagement.ts, ga.ts): same localStorage key/values, same track edge
// function and payload shape, same GA4 Consent Mode gate — nothing runs until the
// visitor clicks "Accept all". Blog posts are a top entry point, so they measure the
// same things the app-side dashboard expects: page views, how far people read, how
// long they stayed, and every click through to the app.
const ANALYTICS = `
<div id="cc" hidden style="position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;justify-content:center;padding:0 16px 16px">
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;width:100%;max-width:768px;border:1px solid #222;background:#0F0F0F;border-radius:12px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.5)">
    <p style="flex:1 1 260px;font-size:14px;color:#A0A0A0;margin:0">We use essential cookies to run this site, and — with your consent — analytics cookies to understand traffic. <a href="/legal/cookies" style="color:#FF5A3C">Cookie Policy</a>.</p>
    <div style="display:flex;gap:8px">
      <button id="cc-e" style="cursor:pointer;border:1px solid #2A2A2A;background:none;border-radius:8px;padding:8px 12px;font-size:14px;font-weight:500;color:#fff">Essential only</button>
      <button id="cc-a" style="cursor:pointer;border:0;background:#DA291C;border-radius:8px;padding:8px 12px;font-size:14px;font-weight:500;color:#fff">Accept all</button>
    </div>
  </div>
</div>
<script>
(function(){
  var KEY="velox:cookie-consent", GA=${JSON.stringify(GA_ID)},
      TRACK="https://qmzfuadxcnweiwbrsutn.supabase.co/functions/v1/track", APP="hub.veloxhouse.co.uk";
  function get(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function ok(){return get()==="all"}
  function sid(){try{var i=localStorage.getItem("vx_sid");if(!i){i=crypto.randomUUID();localStorage.setItem("vx_sid",i)}return i}catch(e){return "anon"}}

  /* ---- GA4, behind Consent Mode v2 ---- */
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments)}
  if(GA)gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",functionality_storage:"granted",security_storage:"granted"});
  var gaOn=false;
  function ga(){
    if(!GA||gaOn||!ok())return;gaOn=true;
    var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA);document.head.appendChild(s);
    gtag("js",new Date());gtag("consent","update",{analytics_storage:"granted"});
    gtag("config",GA,{linker:{domains:["veloxhouse.co.uk","www.veloxhouse.co.uk","hub.veloxhouse.co.uk"],accept_incoming:true}});
  }

  /* ---- first-party events ---- */
  function post(events,beacon){
    if(!ok()||!events.length)return;
    var id=sid();
    var body=JSON.stringify({events:events.map(function(e){return {source:"marketing",event:e.event,path:location.pathname,label:e.label,sessionId:id,props:e.props}})});
    if(beacon){try{if(navigator.sendBeacon&&navigator.sendBeacon(TRACK,new Blob([body],{type:"application/json"})))return}catch(e){}}
    fetch(TRACK,{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:body}).catch(function(){});
  }
  function firstTouch(){
    try{
      var s=sessionStorage.getItem("vx_first_touch");if(s)return JSON.parse(s);
      var p=new URLSearchParams(location.search),ref="";
      try{if(document.referrer&&new URL(document.referrer).host!==location.host)ref=new URL(document.referrer).host}catch(e){}
      var t={utm_source:p.get("utm_source")||"",utm_medium:p.get("utm_medium")||"",utm_campaign:p.get("utm_campaign")||"",referrer:ref,landing:location.pathname};
      sessionStorage.setItem("vx_first_touch",JSON.stringify(t));return t;
    }catch(e){return {}}
  }
  function pageView(){
    if(!ok())return;
    var ua=navigator.userAgent, t=firstTouch();
    var device=/Mobi|Android|iPhone/i.test(ua)?"mobile":/iPad|Tablet/i.test(ua)?"tablet":"desktop";
    var browser=/Edg/.test(ua)?"Edge":/OPR|Opera/.test(ua)?"Opera":/Chrome/.test(ua)?"Chrome":/Firefox/.test(ua)?"Firefox":/Safari/.test(ua)?"Safari":"Other";
    var p=new URLSearchParams(location.search);
    post([{event:"page_view",props:{device:device,browser:browser,referrer:t.referrer||"",
      utm_source:p.get("utm_source")||t.utm_source||"",utm_medium:p.get("utm_medium")||t.utm_medium||"",utm_campaign:p.get("utm_campaign")||t.utm_campaign||""}}],false);
  }

  /* ---- how far they read, how long they stayed ---- */
  var activeMs=0, since=Date.now(), maxScroll=0, reached={}, pending=[], queued=false;
  function measure(){
    queued=false;
    var h=document.documentElement.scrollHeight-window.innerHeight;
    var pct=h<=0?100:Math.round(window.scrollY/h*100);
    maxScroll=Math.min(100,Math.max(maxScroll,pct));
    [25,50,75,100].forEach(function(m){if(maxScroll>=m&&!reached[m]){reached[m]=1;pending.push({event:"scroll_depth",label:String(m)})}});
  }
  function onScroll(){if(!queued){queued=true;requestAnimationFrame(measure)}}
  function flush(){
    if(since){activeMs+=Date.now()-since;since=0}
    var secs=Math.round(activeMs/1000), evs=pending;pending=[];
    if(secs>=1){evs.unshift({event:"page_time",props:{seconds:secs,scroll_max:maxScroll}});activeMs=0}
    post(evs,true);
  }

  /* ---- clicks into the app: carry the visit across the domain ---- */
  function appLink(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return null;try{return new URL(a.href).host===APP?a:null}catch(err){return null}}
  function decorate(a){
    if(!ok())return;
    try{var u=new URL(a.href),t=firstTouch();
      if(!u.searchParams.has("vx_sid"))u.searchParams.set("vx_sid",sid());
      u.searchParams.set("vx_c","all");
      ["utm_source","utm_medium","utm_campaign"].forEach(function(k){if(t[k]&&!u.searchParams.has(k))u.searchParams.set(k,t[k])});
      a.href=u.toString();
    }catch(e){}
  }

  /* ---- wiring ---- */
  function start(){
    ga();pageView();measure();
    window.addEventListener("scroll",onScroll,{passive:true});
    window.addEventListener("resize",onScroll,{passive:true});
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")flush();else if(!since)since=Date.now()});
    window.addEventListener("pagehide",flush);
  }
  document.addEventListener("pointerdown",function(e){var a=appLink(e);if(a)decorate(a)},true);
  document.addEventListener("click",function(e){
    var a=appLink(e);if(!a)return;decorate(a);
    try{var u=new URL(a.href);
      var dest=u.pathname.indexOf("/signup")===0?"signup":u.pathname.indexOf("/login")===0?"login":"app";
      var text=(a.getAttribute("aria-label")||a.textContent||"").replace(/\\s+/g," ").trim().slice(0,60);
      post([{event:"cta_click",label:"blog — "+text,props:{destination:dest,section:"blog",text:text,scroll_at:maxScroll}}],false);
    }catch(err){}
  },true);

  if(get()){start();return}
  var el=document.getElementById("cc");if(!el)return;el.hidden=false;
  function choose(v){try{localStorage.setItem(KEY,v);if(v!=="all")localStorage.removeItem("vx_sid")}catch(e){}el.hidden=true;if(v==="all")start()}
  document.getElementById("cc-a").addEventListener("click",function(){choose("all")});
  document.getElementById("cc-e").addEventListener("click",function(){choose("essential")});
})();
</script>`;

const nav = () => `
<header class="nav"><div class="nav-in">
  <a class="logo" href="/" aria-label="Velox House home"><img src="/velox-lockup-dark.png" alt="Velox House" /></a>
  <nav class="nav-links">
    <a href="/features">Features</a>
    <a href="/#pricing">Pricing</a>
    <a class="on" href="/blog/">Blog</a>
    <a href="/tools">Free tools</a>
  </nav>
  <a class="cta-btn" href="${SIGNUP}">Start free trial</a>
</div></header>`;

const footer = () => `
<footer>
  <div>
    <a href="/">Home</a><a href="/features">Features</a><a href="/blog/">Blog</a>
    <a href="/tools">Free tools</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a>
  </div>
  <div style="margin-top:14px">© ${new Date().getFullYear()} Velox House. AI outreach from a single prompt — built for ambitious UK businesses.</div>
</footer>`;

const ctaBox = () => `
<div class="cta-box">
  <h3>Put your outbound on autopilot</h3>
  <p>Describe your ideal customer in one prompt. Velox AI finds the leads, verifies their emails, writes personalised email + LinkedIn messages, and sends every day from your own inbox. Plans from £19.99/mo.</p>
  <a class="cta-btn" href="${SIGNUP}">Start your 21-day free trial</a>
</div>`;

// In-article lead capture: the same free SPF/DKIM/DMARC check as the SPA
// (src/components/DeliverabilityWidget.tsx + src/lib/deliverability.ts), written
// in vanilla JS so it works on these static pages. Keep the scoring in step with
// the React version. The email is required, which is what makes the free report
// a capture; the lead is posted to the same `inbound-lead` edge function.
const leadBox = () => `
<div class="lead-box" id="vx-check">
  <span class="lead-kicker">Free tool · instant report</span>
  <h3>Are your emails actually reaching the inbox?</h3>
  <p>We'll check your domain's SPF, DKIM, DMARC and MX records live and score your sender reputation out of 100 — free, no sign-up.</p>
  <div class="lead-row">
    <input id="vx-email" type="email" autocomplete="email" placeholder="you@yourbusiness.co.uk" aria-label="Your work email" />
    <button id="vx-go" type="button">Check my domain</button>
  </div>
  <p class="lead-note" id="vx-note">We'll run your report instantly. We may follow up with tips to fix any issues — no spam, unsubscribe anytime.</p>
  <div id="vx-out" hidden></div>
</div>`;

const LEAD_SCRIPT = `
<script>
(function(){
  var box=document.getElementById("vx-check");if(!box)return;
  var input=document.getElementById("vx-email"),btn=document.getElementById("vx-go"),
      note=document.getElementById("vx-note"),out=document.getElementById("vx-out");
  var SELECTORS=["google","selector1","selector2","k1","default","dkim","mail"];
  var ANON=${JSON.stringify(SUPABASE_ANON_KEY)};
  function dns(name,type){
    return fetch("https://dns.google/resolve?name="+encodeURIComponent(name)+"&type="+type)
      .then(function(r){return r.json()})
      .then(function(d){return (d.Answer||[]).map(function(a){return a.data.replace(/^"|"$/g,"").replace(/" "/g,"")})})
      .catch(function(){return []});
  }
  function grade(s){return s>=90?"A":s>=80?"B":s>=65?"C":s>=50?"D":"F"}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function row(r){
    return '<div class="lead-check"><span class="'+(r.pass?"ok":"no")+'">'+(r.pass?"&#10003;":"&#10007;")+
      '</span><div><strong>'+esc(r.label)+'</strong><em>'+esc(r.detail)+'</em></div></div>';
  }
  function run(){
    var email=(input.value||"").trim().toLowerCase();
    if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){note.textContent="Enter your work email, e.g. you@yourbusiness.co.uk";note.className="lead-note err";return}
    var d=email.split("@")[1];
    note.className="lead-note";note.textContent="We'll run your report instantly. We may follow up with tips to fix any issues — no spam, unsubscribe anytime.";
    btn.disabled=true;btn.textContent="Checking…";
    Promise.all([dns(d,"MX"),dns(d,"TXT"),dns("_dmarc."+d,"TXT")]).then(function(res){
      var mx=res[0],txt=res[1],dm=res[2];
      // Null MX (RFC 7505, target ".") means the domain accepts no mail — not a pass.
      var hosts=mx.map(function(r){return r.split(" ").pop()||""}).filter(function(h){return h&&h!=="."});
      var hasMx=hosts.length>0;
      var hasSpf=txt.some(function(r){return r.toLowerCase().indexOf("v=spf1")>-1});
      var rec=null;dm.forEach(function(r){if(r.toLowerCase().indexOf("v=dmarc1")>-1)rec=r});
      var enforced=!!rec&&/p=(quarantine|reject)/i.test(rec);
      return Promise.all(SELECTORS.map(function(s){return dns(s+"._domainkey."+d,"TXT")})).then(function(ks){
        // "p=" with nothing after it is a revoked key, so require real base64.
        var hasDkim=ks.some(function(a){return a.some(function(r){return /p=[A-Za-z0-9+/]{40,}/.test(r)})});
        var rows=[
          {label:"Mail server configured (MX)",detail:hasMx?("Receiving mail via "+hosts[0].replace(/\\.$/,"")):(mx.length>0?"Null MX — this domain explicitly accepts no email":"No MX record — this domain can't receive email"),pass:hasMx},
          {label:"SPF record",detail:hasSpf?"SPF found — authorises who can send as you":"Missing SPF — a top cause of spam-foldering",pass:hasSpf},
          {label:"DMARC policy",detail:rec?(enforced?"DMARC enforced (quarantine/reject) — strong":"DMARC present but set to p=none (monitoring only)"):"No DMARC — leaves your domain open to spoofing",pass:enforced},
          {label:"DKIM signing",detail:hasDkim?"DKIM key detected on a common selector":"No DKIM found on common selectors — emails may look unsigned",pass:hasDkim}
        ];
        var w=[25,30,25,20],score=0;rows.forEach(function(r,i){if(r.pass)score+=w[i]});
        out.hidden=false;
        out.innerHTML='<div class="lead-score"><span class="num">'+score+'</span><span class="cap">deliverability</span><span class="badge">Grade '+grade(score)+'</span></div>'+
          rows.map(row).join("")+
          '<div class="lead-cta"><h4>Fix it — and keep it fixed — inside Velox House.</h4>'+
          '<p>Guided SPF, DKIM and DMARC, domain warming, safe sending schedules, bounce monitoring and a pre-send spam checker — so you land in the inbox every time.</p>'+
          '<a class="cta-btn" href="${SIGNUP}">Protect my sender reputation</a></div>';
        var h={"Content-Type":"application/json"};if(ANON)h.Authorization="Bearer "+ANON;
        fetch("${SUPABASE_URL}/functions/v1/inbound-lead",{method:"POST",headers:h,
          body:JSON.stringify({name:"",email:email,businessName:d,chipTier:"Deliverability "+grade(score)+" ("+score+"/100)",
            message:"Ran the free deliverability check from the blog ("+location.pathname+") for "+d+" — scored "+score+"/100 (grade "+grade(score)+"). "+
              rows.map(function(r){return r.label+": "+(r.pass?"pass":"fail")}).join("; "),
            source:"blog_deliverability_check"})}).catch(function(){});
        try{
          if(localStorage.getItem("velox:cookie-consent")==="all"){
            var id=localStorage.getItem("vx_sid")||"anon";
            fetch("${SUPABASE_URL}/functions/v1/track",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
              body:JSON.stringify({source:"marketing",event:"lead_capture",path:location.pathname,label:"blog_deliverability_check",sessionId:id,props:{score:score}})}).catch(function(){});
          }
        }catch(e){}
      });
    }).catch(function(){
      note.className="lead-note err";note.textContent="Couldn't run the check — please try again.";
    }).then(function(){btn.disabled=false;btn.textContent="Check my domain"});
  }
  btn.addEventListener("click",run);
  input.addEventListener("keydown",function(e){if(e.key==="Enter")run()});
})();
</script>`;

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

  // Two in-article breaks: the free-check capture roughly a third of the way in
  // (while attention is highest), the product CTA later and again at the end.
  let html = post.html;
  const h2s = [...html.matchAll(/<h2/g)];
  if (h2s.length >= 5) {
    // Splice from the back so the earlier offset stays valid.
    html = html.slice(0, h2s[3].index) + ctaBox() + html.slice(h2s[3].index);
    html = html.slice(0, h2s[1].index) + leadBox() + html.slice(h2s[1].index);
  } else if (h2s.length >= 2) {
    html = html.slice(0, h2s[1].index) + leadBox() + html.slice(h2s[1].index);
  } else {
    html = leadBox() + html;
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
${ANALYTICS}${CF_TAG}
${LEAD_SCRIPT}
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
<div style="max-width:760px;margin:0 auto;padding:0 24px">${leadBox()}</div>
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
${ANALYTICS}${CF_TAG}
${LEAD_SCRIPT}
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
  { loc: `${SITE}/tools/email-deliverability-check`, lastmod: today, changefreq: "monthly", priority: "0.8" },
  { loc: `${SITE}/tools/cold-email-roi-calculator`, lastmod: today, changefreq: "monthly", priority: "0.8" },
  { loc: `${SITE}/tools/plan-finder`, lastmod: today, changefreq: "monthly", priority: "0.6" },
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
