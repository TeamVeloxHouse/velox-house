/**
 * Tiny className combiner — joins truthy class strings with a space.
 * Avoids pulling in clsx/tailwind-merge for this small site.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * The Velox House SaaS app. Marketing CTAs (Start free / Sign in) point here.
 * Override with VITE_APP_URL in dev (e.g. http://localhost:3002).
 */
export const APP_URL =
  import.meta.env.VITE_APP_URL ?? "https://app.veloxhouse.co.uk";
export const SIGNUP_URL = `${APP_URL}/signup`;
export const LOGIN_URL = `${APP_URL}/login`;

/**
 * Shared framer-motion fade-up variant used across sections.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Container variant that staggers its children.
 */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Shared viewport config for whileInView animations. */
export const inViewport = { once: true, margin: "-50px" } as const;
