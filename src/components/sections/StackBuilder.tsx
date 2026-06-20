import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { inViewport } from "../../lib/utils";
import { submitLead } from "../../lib/supabase";

/* ------------------------------------------------------------------ */
/* Question data                                                       */
/* ------------------------------------------------------------------ */

interface Question {
  prompt: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    prompt: "What is your single biggest marketing challenge right now?",
    options: [
      "Not enough new leads or enquiries",
      "Website isn't converting",
      "Can't track what's working — no visibility",
      "Marketing is taking too much of my time",
      "Paying too much for poor results",
    ],
  },
  {
    prompt: "What does your current marketing setup look like?",
    options: [
      "Nothing — starting from scratch",
      "Basic website, no CRM or outreach",
      "Website + some social, but nothing connected",
      "Full stack but fragmented and disconnected",
      "Agency doing it all — not seeing results",
    ],
  },
  {
    prompt: "What's your primary goal in the next 6 months?",
    options: [
      "Get visible and credible online",
      "Generate a consistent flow of leads",
      "Convert more of the leads I already get",
      "Build a brand that commands premium prices",
      "Reduce time spent on marketing",
    ],
  },
  {
    prompt: "How many new clients do you want per month?",
    options: [
      "1–3 high-value clients",
      "5–10 regular clients",
      "20+ volume clients",
      "I want to retain existing clients better",
    ],
  },
  {
    prompt: "What's your monthly marketing budget?",
    options: [
      "Under £750/month",
      "£750–£1,500/month",
      "£1,500–£2,500/month",
      "£2,500–£4,000/month",
      "£4,000+/month",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Recommendation logic                                                */
/* ------------------------------------------------------------------ */

interface Plan {
  name: string;
  chipLine: string;
  why: string;
  stack: string[];
}

const PLANS: Record<string, Plan> = {
  white: {
    name: "The Starter Hand",
    chipLine: "White Chip · £750/mo",
    why: "You're laying the foundations. We'll get you visible, credible and capturing every enquiry — without overcommitting before the system is proven.",
    stack: ["Custom Website", "AI-Powered CRM", "War Room Dashboard"],
  },
  red: {
    name: "The Growth Hand",
    chipLine: "Red Chip · £1,500/mo",
    why: "Your priority is a reliable flow of leads. We'll run personalised outreach to your ideal clients every month and track every reply in one place.",
    stack: ["Outreach Engine", "LinkedIn Signal", "AI-Powered CRM", "War Room Dashboard"],
  },
  blue: {
    name: "The Scale Hand",
    chipLine: "Blue Chip · £2,500/mo",
    why: "You want marketing off your plate entirely. We'll run content, outreach and pipeline together so you spend minutes a week, not days.",
    stack: ["Content Machine", "Outreach Engine", "AI-Powered CRM", "War Room Dashboard"],
  },
  black: {
    name: "The High-Roller Hand",
    chipLine: "Black Chip · £4,000+/mo",
    why: "You're running multi-channel acquisition at scale. We'll deploy the full stack with a dedicated strategist and custom integrations built around you.",
    stack: [
      "Full Stack",
      "Dedicated Strategist",
      "Custom Integrations",
      "War Room Dashboard",
    ],
  },
};

function recommend(answers: (string | null)[]): Plan {
  const challenge = answers[0];
  const setup = answers[1];
  const budget = answers[4];

  // Priority order matches the spec.
  if (budget === "Under £750/month" || setup === "Nothing — starting from scratch") {
    return PLANS.white;
  }
  if (budget === "£750–£1,500/month" || challenge === "Not enough new leads or enquiries") {
    return PLANS.red;
  }
  if (
    budget === "£1,500–£2,500/month" ||
    challenge === "Marketing is taking too much of my time"
  ) {
    return PLANS.blue;
  }
  // Higher budgets
  if (budget === "£2,500–£4,000/month" || budget === "£4,000+/month") {
    return PLANS.black;
  }
  // Fallback
  return PLANS.red;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

type Stage = "questions" | "result" | "success";

export default function StackBuilder() {
  const [stage, setStage] = useState<Stage>("questions");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array(QUESTIONS.length).fill(null)
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const plan = recommend(answers);
  const progress =
    stage === "questions" ? (step / QUESTIONS.length) * 100 : 100;

  const select = (option: string) => {
    const next = [...answers];
    next[step] = option;
    setAnswers(next);
    setDirection(1);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setStage("result");
    }
  };

  const back = () => {
    setDirection(-1);
    if (stage === "result") {
      setStage("questions");
      setStep(QUESTIONS.length - 1);
    } else if (step > 0) {
      setStep(step - 1);
    }
  };

  const reset = () => {
    setStage("questions");
    setStep(0);
    setAnswers(Array(QUESTIONS.length).fill(null));
    setName("");
    setEmail("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({
        name,
        email,
        businessName: "",
        chipTier: plan.chipLine,
        message: `Stack Builder recommendation: ${plan.name}. Answers: ${answers.join(" | ")}`,
        source: "website_stack_builder",
      });
      setStage("success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <section id="stack-builder" className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold text-[#DA291C]">Free tool</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            Not sure where to start?
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Answer 5 questions. Get your personalised marketing stack
            recommendation — free, in 60 seconds.
          </p>
        </motion.div>

        {/* Card */}
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#0F0F0F]">
          {/* Progress bar */}
          <div className="h-1 w-full bg-[#1A1A1A]">
            <motion.div
              className="h-full bg-[#DA291C]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="p-8 md:p-10">
            <AnimatePresence mode="wait" custom={direction}>
              {/* Questions */}
              {stage === "questions" && (
                <motion.div
                  key={`q-${step}`}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#DA291C]">
                      Question {step + 1} of {QUESTIONS.length}
                    </span>
                    {step > 0 && (
                      <button
                        onClick={back}
                        className="flex items-center gap-1 text-xs text-[#666] transition-colors hover:text-white"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    )}
                  </div>

                  <h3 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em] text-white">
                    {QUESTIONS[step].prompt}
                  </h3>

                  <div className="mt-6 space-y-3">
                    {QUESTIONS[step].options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => select(opt)}
                        className="group flex w-full items-center justify-between rounded-xl border border-[#1A1A1A] p-4 text-left text-sm text-white/80 transition-all hover:border-[#DA291C]/60 hover:bg-[#141414]"
                      >
                        <span>{opt}</span>
                        <ArrowRight
                          size={16}
                          className="text-[#666] transition-colors group-hover:text-[#DA291C]"
                        />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Result */}
              {stage === "result" && (
                <motion.div
                  key="result"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#DA291C]">
                      Your recommendation
                    </span>
                    <button
                      onClick={back}
                      className="flex items-center gap-1 text-xs text-[#666] transition-colors hover:text-white"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                  </div>

                  <h3 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-white">
                    {plan.name}
                  </h3>
                  <div className="mt-2 text-base font-semibold text-[#DA291C]">
                    {plan.chipLine}
                  </div>
                  <p className="mt-4 text-sm text-[#A0A0A0]">{plan.why}</p>

                  <div className="mt-5 space-y-2">
                    {plan.stack.map((s) => (
                      <div
                        key={s}
                        className="flex items-center gap-3 rounded-lg border border-[#1A1A1A] bg-[#141414] p-3"
                      >
                        <span className="text-[#DA291C]">✦</span>
                        <span className="text-sm text-white">{s}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                    {error && <p className="text-xs text-[#DA291C]">{error}</p>}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-md bg-[#DA291C] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
                    >
                      {submitting ? "Sending…" : "Send My Recommendation →"}
                    </button>
                  </form>

                  <a
                    href="#seat"
                    className="mt-4 block text-center text-sm text-[#A0A0A0] transition-colors hover:text-white"
                  >
                    Or book a call directly
                  </a>
                </motion.div>
              )}

              {/* Success */}
              {stage === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-6 text-center"
                >
                  <div className="text-4xl text-[#DA291C]">✦</div>
                  <h3 className="mt-4 font-display text-3xl font-bold tracking-[-0.02em] text-white">
                    Your hand is dealt.
                  </h3>
                  <p className="mt-3 text-sm text-[#A0A0A0]">
                    Recommendation on its way to {email || "your inbox"}.
                  </p>
                  <a
                    href="#seat"
                    className="mt-6 inline-block rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                  >
                    Book The Table Now →
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Start over */}
        {stage !== "questions" && (
          <div className="mt-6 text-center">
            <button
              onClick={reset}
              className="text-sm text-[#666] transition-colors hover:text-white"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
