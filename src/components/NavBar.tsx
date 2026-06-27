import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn, LOGIN_URL, SIGNUP_URL } from "../lib/utils";
import Logo from "./Logo";

const NAV_LINKS = [
  { label: "Product", href: "/#product" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Customers", href: "/#testimonials" },
  { label: "Free email check", href: "/tools" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Lock body scroll when the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleNav = (href: string) => {
    setOpen(false);
    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (window.location.pathname !== "/") {
        navigate("/");
        // wait for home to mount, then scroll
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[#1A1A1A] bg-[rgba(10,10,10,0.85)] backdrop-blur-xl">
      <nav className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="flex items-center"
            aria-label="Velox House home"
          >
            <Logo />
          </Link>

          {/* Center links */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNav(link.href)}
                className="text-sm text-[#A0A0A0] transition-colors hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right actions — into the app */}
          <div className="hidden items-center gap-4 md:flex">
            <a
              href={LOGIN_URL}
              className="text-sm text-[#A0A0A0] transition-colors hover:text-white"
            >
              Sign in
            </a>
            <a
              href={SIGNUP_URL}
              className="rounded-full bg-[#DA291C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
            >
              Start free
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="text-white md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      <div
        className={cn(
          "overflow-hidden border-t border-[#1A1A1A] bg-[rgba(10,10,10,0.97)] backdrop-blur-xl transition-[max-height] duration-300 md:hidden",
          open ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNav(link.href)}
              className="py-2 text-left text-sm text-[#A0A0A0] transition-colors hover:text-white"
            >
              {link.label}
            </button>
          ))}
          <div className="mt-3 flex flex-col gap-3 border-t border-[#1A1A1A] pt-4">
            <a
              href={LOGIN_URL}
              className="text-left text-sm text-[#A0A0A0] hover:text-white"
            >
              Sign in
            </a>
            <a
              href={SIGNUP_URL}
              className="rounded-full bg-[#DA291C] px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
            >
              Start free
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
