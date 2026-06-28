import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import { trackPageView } from "./lib/track";

// Records a page_view on every route + hash change (so /#pricing etc. are tracked).
function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    trackPageView(loc.pathname + loc.hash);
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
          <Route path="/tools" element={<Tools />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
