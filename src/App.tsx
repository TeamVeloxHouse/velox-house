import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Features from "./pages/Features";
import Tools from "./pages/Tools";
import { trackPageView } from "./lib/track";
import { applyRouteMeta } from "./lib/seo";

// Records a page_view on every route + hash change (so /#pricing etc. are tracked),
// and swaps the per-route SEO tags (title/description/canonical).
function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    trackPageView(loc.pathname + loc.hash);
    applyRouteMeta(loc.pathname);
    // Land new pages at the top; leave in-page hash anchors to the browser.
    if (!loc.hash) window.scrollTo(0, 0);
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
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
