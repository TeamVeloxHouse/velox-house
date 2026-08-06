import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import CookieConsent from "./components/CookieConsent";
import Home from "./pages/Home";
import Features from "./pages/Features";
import Tools from "./pages/Tools";
import EmailDeliverabilityCheck from "./pages/tools/EmailDeliverabilityCheck";
import ColdEmailRoiCalculator from "./pages/tools/ColdEmailRoiCalculator";
import PlanFinder from "./pages/tools/PlanFinder";
import Legal from "./pages/Legal";
import ExitIntent from "./components/ExitIntent";
import { trackPageView } from "./lib/track";
import { initEngagement, startPage } from "./lib/engagement";
import { adoptOptOutParam } from "./lib/optout";
import { applyRouteMeta } from "./lib/seo";

// Records a page_view on every route + hash change (so /#pricing etc. are tracked),
// swaps the per-route SEO tags (title/description/canonical), and restarts the
// engagement clock (time on page, scroll depth, per-section dwell).
function RouteTracker() {
  const loc = useLocation();
  // Honour ?vx_optout= before anything is measured, so the very first page view of an
  // opted-out browser is excluded too.
  useEffect(() => { adoptOptOutParam(); initEngagement(); }, []);
  useEffect(() => {
    applyRouteMeta(loc.pathname); // set the title before page_view reports it
    trackPageView(loc.pathname + loc.hash);
    // Land new pages at the top; leave in-page hash anchors to the browser.
    // (Before startPage, so the new page's scroll depth starts from where it lands.)
    if (!loc.hash) window.scrollTo(0, 0);
    startPage(loc.pathname + loc.hash);
  }, [loc.pathname, loc.hash]);
  return null;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white antialiased">
      <RouteTracker />
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/tools" element={<Tools />} />
          <Route
            path="/tools/email-deliverability-check"
            element={<EmailDeliverabilityCheck />}
          />
          <Route
            path="/tools/cold-email-roi-calculator"
            element={<ColdEmailRoiCalculator />}
          />
          <Route path="/tools/plan-finder" element={<PlanFinder />} />
          <Route path="/legal/:slug" element={<Legal />} />
        </Routes>
      </main>
      <Footer />
      <CookieConsent />
      <ExitIntent />
    </div>
  );
}
