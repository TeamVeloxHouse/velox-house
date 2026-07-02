import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] || "http://localhost:3000/";
const PORT = 9231;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const udd = join(tmpdir(), "velox-diag2");
rmSync(udd, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new","--no-sandbox","--autoplay-policy=no-user-gesture-required",`--remote-debugging-port=${PORT}`,`--user-data-dir=${udd}`,"about:blank"], { detached: true, stdio: "ignore" });
edge.unref();
let v=null; for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);if(r.ok){v=await r.json();break;}}catch{} await sleep(500);}
const browser = await puppeteer.connect({ browserWSEndpoint: v.webSocketDebuggerUrl, defaultViewport:{width:1440,height:900} });
const page = await browser.newPage();
const errors=[]; const failedReq=[];
page.on("console",(m)=>{ if(m.type()==="error") errors.push(m.text()); });
page.on("pageerror",(e)=>errors.push("PAGEERR: "+e.message));
page.on("requestfailed",(r)=>failedReq.push(r.url()+" -> "+(r.failure()?.errorText)));
page.on("response",(r)=>{ if(r.url().includes("velox-hero")) console.log("RESP", r.status(), r.url()); });

console.log("NAVIGATING TO", URL);
await page.goto(URL, { waitUntil:"networkidle2" });
// scroll the video into view
await page.evaluate(()=>{ const vd=document.querySelector("video"); if(vd) vd.scrollIntoView({block:"center"}); });
await sleep(1500);
const t1 = await page.evaluate(()=>{ const vd=document.querySelector("video"); return vd?vd.currentTime:null; });
await sleep(2000);
const state = await page.evaluate(()=>{
  const vd=document.querySelector("video");
  if(!vd) return {exists:false};
  return { exists:true, currentSrc:vd.currentSrc, paused:vd.paused, ended:vd.ended,
    readyState:vd.readyState, networkState:vd.networkState, currentTime:vd.currentTime,
    duration:vd.duration, videoWidth:vd.videoWidth, videoHeight:vd.videoHeight,
    error:vd.error?(vd.error.code+":"+vd.error.message):null,
    offsetH:vd.offsetHeight, offsetW:vd.offsetWidth };
});
// try to force play and capture the promise rejection reason
const playResult = await page.evaluate(async ()=>{
  const vd=document.querySelector("video"); if(!vd) return "no video";
  try { await vd.play(); return "play() OK, paused="+vd.paused; }
  catch(e){ return "play() REJECTED: "+e.name+" "+e.message; }
});
console.log("t1 currentTime:", t1);
console.log("VIDEO STATE:", JSON.stringify(state,null,2));
console.log("PLAY RESULT:", playResult);
console.log("CONSOLE ERRORS:", errors.length?errors:"(none)");
console.log("FAILED REQUESTS:", failedReq.length?failedReq:"(none)");
await browser.disconnect();
try{process.kill(-edge.pid);}catch{}
process.exit(0);
