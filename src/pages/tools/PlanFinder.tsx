import StackBuilder from "../../components/sections/StackBuilder";

export default function PlanFinder() {
  return (
    <>
      {/* The section below is built to sit mid-homepage, so this page supplies
          the h1 and the spacing that clears the fixed nav. */}
      <section data-vx-section="plan-finder" className="bg-[#0A0A0A] px-6 pt-32 text-center md:px-12 md:pt-40">
        <div className="mx-auto max-w-2xl">
          <span className="text-sm font-semibold text-[#DA291C]">
            Free tool · 60 seconds
          </span>
          <h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-white md:text-6xl">
            Which outreach plan do you actually need?
          </h1>
          <p className="mt-5 text-[#A0A0A0]">
            Plans are usually sold on feature lists you can't compare. Answer five
            questions about your volume, budget and goals instead, and we'll tell
            you which one fits — including if that's the cheapest one.
          </p>
        </div>
      </section>
      <StackBuilder />
    </>
  );
}
