// Pings IndexNow (Bing, Yandex, Seznam, Naver, Yep) with every URL in the live
// sitemap. Run after a deploy: node scripts/indexnow.mjs
// Google does not support IndexNow — Google discovers via Search Console + sitemap.

const HOST = "veloxhouse.co.uk";
const KEY = "da20d401aed3e60093cf629c59ac72d7";

const res = await fetch(`https://${HOST}/sitemap.xml`);
if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) throw new Error("no URLs found in live sitemap");

const ping = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: submitted ${urls.length} URLs — HTTP ${ping.status} ${ping.statusText}`);
if (!(ping.status === 200 || ping.status === 202)) {
  console.error(await ping.text());
  process.exit(1);
}
