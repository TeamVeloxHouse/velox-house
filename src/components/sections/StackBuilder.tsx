import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { inViewport, SIGNUP_URL } from "../../lib/utils";
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
    prompt: "What's your biggest outreach challenge right now?",
    options: [
      "I don't have enough leads to contact",
      "My cold emails get ignored",
      "I forget to follow up",
      "I can't tell what's working",
      "My emails land in spam",
    ],
  },
  {
    prompt: "How do you do outreach today?",
    options: [
      "Nothing yet — starting from scratch",
      "Manually, one email at a time",
      "A patchwork of spreadsheets and tools",
      "Another outreach tool I've outgrown",
      "An agency does it for me",
    ],
  },
  {
    prompt: "What's your main goal for the next 90 days?",
    options: [
      "Book more meetings",
      "Build a repeatable outreach system",
      "Save time on manual sending",
      "Scale outbound across a team",
      "Just test the waters cheaply",
    ],
  },
  {
    prompt: "How many new prospects do you want to reach each month?",
    options: [
      "Up to 50 (just testing)",
      "A few hundred",
      "Around 800",
      "2,000+",
    ],
  },
  {
    prompt: "What monthly budget works for you?",
    options: ["£0 — free only", "Up to £29", "Up to £69", "£149+"],
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
  free: {
    name: "Free",
    chipLine: "Free · £0/mo",
    why: "Start with zero risk. You get real lead discovery, AI research and messaging, and unlimited sending — enough to land your first meetings before you pay a penny.",
    stack: [
      "50 contacts / month",
      "50 AI credits / month",
      "Unlimited email sending",
      "1 seat · 1 mailbox",
    ],
  },
  starter: {
    name: "Starter",
    chipLine: "Starter · £29/mo",
    why: "Perfect once you're ready for a steady flow. More contacts and credits to run consistent, personalised outreach with sequences and analytics behind it.",
    stack: [
      "300 contacts / month",
      "500 AI credits / month",
      "Sequences & analytics",
      "Unlimited email sending",
    ],
  },
  growth: {
    name: "Growth",
    chipLine: "Growth · £69/mo",
    why: "Built for scaling outbound, especially with a team. Higher allowances and seats so everyone works from one shared pipeline and sequence library.",
    stack: [
      "800 contacts / month",
      "2,000 AI credits / month",
      "3 seats for your team",
      "Everything in Starter",
    ],
  },
  pro: {
    name: "Pro",
    chipLine: "Pro · £149/mo",
    why: "For agencies and high-volume senders. The largest allowances, the most seats and mailboxes, and priority support to keep the machine running.",
    stack: [
      "2,000 contacts / month",
      "4,000 AI credits / month",
      "5 seats · 25 mailboxes",
      "Priority support",
    ],
  },
};

function recommend(answers: (string | null)[]): Plan {
  const setup = answers[1];
  const goal = answers[2];
  const volume = answers[3];
  const budget = answers[4];

  if (
    budget === "£149+" ||
    volume === "2,000+"
  ) {
    return PLANS.pro;
  }
  if (
    budget === "Up to £69" ||
    volume === "Around 800" ||
    goal === "Scale outbound across a team"
  ) {
    return PLANS.growth;
  }
  if (budget === "Up to £29" || volume === "A few hundred") {
    return PLANS.starter;
  }
  if (
    budget === "£0 — free only" ||
    volume === "Up to 50 (just testing)" ||
    setup === "Nothing yet — starting from scratch" ||
    goal === "Just test the waters cheaply"
  ) {
    return PLANS.free;
  }
  return PLANS.starter;
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
            Not sure which plan you need?
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Answer 5 quick questions and we'll recommend the right Velox House plan
            for you — free, in 60 seconds.
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
                      Your recommended plan
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
                      {submitting ? "Sending…" : "Email Me This Plan →"}
                    </button>
                  </form>

                  <a
                    href={SIGNUP_URL}
                    className="mt-4 block text-center text-sm text-[#A0A0A0] transition-colors hover:text-white"
                  >
                    Or start free right now →
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
                    You're all set.
                  </h3>
                  <p className="mt-3 text-sm text-[#A0A0A0]">
                    We've sent your recommended plan to {email || "your inbox"}.
                  </p>
                  <a
                    href={SIGNUP_URL}
                    className="mt-6 inline-block rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                  >
                    Start Free Now →
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
