import { motion } from "framer-motion";

// Animated product showcase for the hero — a Remotion-rendered clip (brand intro →
// tagline → live dashboard). Autoplays muted on loop; falls back to the poster image
// where autoplay/video is unavailable. Source project: /remotion.
export default function HeroVideo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.55 }}
      className="mt-16 w-full"
    >
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0D0D0D] shadow-2xl">
        <video
          className="block h-auto w-full"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/velox-hero-poster.jpg"
          aria-label="Velox House product demo: find prospects, research with AI, write personalised emails, and book meetings on autopilot."
        >
          <source src="/velox-hero.webm" type="video/webm" />
          <source src="/velox-hero.mp4" type="video/mp4" />
        </video>
      </div>
    </motion.div>
  );
}
