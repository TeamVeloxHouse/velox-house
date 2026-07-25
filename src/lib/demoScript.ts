// Canned content for the hero's "Try Velox AI" demo. Everything the widget shows
// comes from here — no API calls, no credits. Company names are fictional.

export interface DemoCompany {
  name: string;
  detail: string; // one-line researched observation shown on the card
  fit: number; // 0-100 fit score
}

export interface DemoIndustry {
  id: string;
  label: string; // reads naturally after "at" — e.g. "gyms & leisure businesses"
  short: string; // short noun for copy — e.g. "gyms"
  found: number; // companies "discovered" before ranking
  searches: (loc: string) => string[];
  companies: (loc: string) => DemoCompany[];
  email: (role: RoleId, loc: string) => { subject: string; body: string };
}

export type RoleId = "directors" | "owners" | "marketing";

export const COUNTS = [25, 50, 100] as const;

export const ROLES: { id: RoleId; label: string }[] = [
  { id: "directors", label: "directors" },
  { id: "owners", label: "owners" },
  { id: "marketing", label: "marketing managers" },
];

export const LOCATIONS = ["Manchester", "London", "Bristol", "Leeds", "Birmingham"];

const greet = (role: RoleId) =>
  role === "marketing" ? "Hi Sarah" : role === "owners" ? "Hi James" : "Hi Karen";

const firstNameNote = "{{first_name}}";

export const INDUSTRIES: DemoIndustry[] = [
  {
    id: "gyms",
    label: "gyms & leisure businesses",
    short: "gyms",
    found: 214,
    searches: (loc) => [
      `“gym” OR “fitness studio” near ${loc}`,
      `boutique fitness & PT studios · SIC 93130`,
      `leisure centres within 15 miles of ${loc}`,
      `broaden: climbing walls, padel clubs, swim schools`,
    ],
    companies: (loc) => [
      { name: "The Foundry Gym", detail: `Independent strength gym, ${loc} — just opened a second site`, fit: 94 },
      { name: "Pulse & Motion Studios", detail: "Boutique classes studio — hiring front-of-house, growing fast", fit: 91 },
      { name: "ClubForm Leisure", detail: `3-site leisure group across Greater ${loc}`, fit: 88 },
      { name: "Ironworks Fitness", detail: "24/7 gym, strong reviews mentioning waiting lists", fit: 85 },
    ],
    email: (role, loc) => ({
      subject: "second site",
      body: `${greet(role)} — saw The Foundry just opened its second site in ${loc}. Congrats, that's a big step.

${
  role === "marketing"
    ? "Two sites usually means double the admin around class no-shows and lapsed members — and marketing gets asked to fix it."
    : "Most gym " +
      (role === "owners" ? "owners" : "directors") +
      " tell us the second site is where no-shows and lapsed memberships start slipping through the cracks."
}

We help gyms like yours win back lapsed members automatically — typically a few dozen recovered in the first month. Worth a 15-minute look next week?

— you (sent from your own inbox)`,
    }),
  },
  {
    id: "construction",
    label: "construction firms",
    short: "construction firms",
    found: 187,
    searches: (loc) => [
      `“construction” OR “building contractor” near ${loc}`,
      `groundworks & civil engineering · SIC 41201, 43999`,
      `active sites & planning applications around ${loc}`,
      `broaden: M&E contractors, fit-out specialists`,
    ],
    companies: (loc) => [
      { name: "Northgate Build Group", detail: `Mid-size contractor, ${loc} — won two commercial tenders recently`, fit: 95 },
      { name: "Harlow & Vane Contractors", detail: "Design-and-build firm, 40+ staff, hiring site managers", fit: 90 },
      { name: "Ashton Groundworks", detail: `Civils specialist covering the ${loc} corridor`, fit: 87 },
      { name: "Brickfield Construction", detail: "Residential developer — 3 live sites listed", fit: 84 },
    ],
    email: (role, loc) => ({
      subject: `the two new tenders`,
      body: `${greet(role)} — noticed Northgate picked up two commercial tenders around ${loc} recently. Nice run.

${
  role === "marketing"
    ? "When the order book fills like that, pipeline work usually stops — then there's a cliff in six months."
    : "Most " +
      (role === "owners" ? "owners" : "directors") +
      " we speak to say the same thing: when delivery is busy, winning the next job gets ignored."
}

We keep a steady stream of qualified enquiries coming in while your team stays on the tools. Open to a quick call next week?

— you (sent from your own inbox)`,
    }),
  },
  {
    id: "accountancy",
    label: "accountancy practices",
    short: "accountancy practices",
    found: 243,
    searches: (loc) => [
      `“accountants” OR “chartered accountancy” near ${loc}`,
      `practices 5–50 staff · SIC 69201, 69202`,
      `advisory & bookkeeping firms around ${loc}`,
      `broaden: payroll bureaus, tax specialists`,
    ],
    companies: (loc) => [
      { name: "Ledgerstone Accountants", detail: `Growing ${loc} practice — just added a cloud advisory team`, fit: 93 },
      { name: "Milton Rowe LLP", detail: "20-partner firm, active in owner-managed business space", fit: 90 },
      { name: "BrightBooks Advisory", detail: "Xero-first practice, publishes a monthly SME newsletter", fit: 86 },
      { name: "Fairview & Co", detail: `Long-established firm serving ${loc} SMEs`, fit: 83 },
    ],
    email: (role, loc) => ({
      subject: "cloud advisory team",
      body: `${greet(role)} — saw Ledgerstone has just built out a cloud advisory team. Smart move given where the market's going.

${
  role === "marketing"
    ? "The usual challenge after that investment: filling the advisory pipeline beyond the existing client base."
    : "The " +
      (role === "owners" ? "owners" : "partners") +
      " we work with say the hard part isn't the service — it's getting in front of enough of the right SMEs to sell it."
}

We help practices like yours book meetings with owner-managed businesses in ${loc} every week, without the partners doing the chasing. Worth 15 minutes?

— you (sent from your own inbox)`,
    }),
  },
  {
    id: "restaurants",
    label: "restaurants",
    short: "restaurants",
    found: 268,
    searches: (loc) => [
      `“restaurant” OR “bistro” near ${loc}`,
      `independents & small groups · SIC 56101`,
      `recently opened venues around ${loc}`,
      `broaden: gastropubs, café-bars, event caterers`,
    ],
    companies: (loc) => [
      { name: "The Copper Fig", detail: `Independent, central ${loc} — strong reviews, opened last year`, fit: 92 },
      { name: "Salt & Ember", detail: "Two-site grill concept — actively promoting private dining", fit: 90 },
      { name: "The Old Mill Bistro", detail: `Neighbourhood favourite on the edge of ${loc}`, fit: 86 },
      { name: "Casa Verde Kitchen", detail: "Plant-forward menu, busy weekend trade", fit: 82 },
    ],
    email: (role, loc) => ({
      subject: "private dining at Salt & Ember",
      body: `${greet(role)} — noticed Salt & Ember has been pushing private dining lately. That's usually the highest-margin cover in the room.

${
  role === "marketing"
    ? "Filling midweek private hire is the classic gap — weekends sell themselves."
    : "Most " +
      (role === "owners" ? "owner-operators" : "directors") +
      " tell us weekends look after themselves — it's midweek covers and private hire that need help."
}

We help ${loc} venues like yours fill midweek bookings without discounting. Fancy a quick chat this week?

— you (sent from your own inbox)`,
    }),
  },
  {
    id: "estate-agents",
    label: "estate agents",
    short: "estate agents",
    found: 176,
    searches: (loc) => [
      `“estate agents” OR “lettings” near ${loc}`,
      `independent agencies · SIC 68310, 68320`,
      `sales & lettings branches around ${loc}`,
      `broaden: property management, block managers`,
    ],
    companies: (loc) => [
      { name: "Hartley & Finch Estates", detail: `Independent ${loc} agency — just rebranded, expanding lettings`, fit: 94 },
      { name: "Cornerstone Lettings", detail: "Lettings specialist managing 400+ units", fit: 89 },
      { name: "Fox Row Property", detail: `Boutique sales agency, prime ${loc} postcodes`, fit: 87 },
      { name: "Beacon Residential", detail: "Two-branch agency, strong Google review velocity", fit: 84 },
    ],
    email: (role, loc) => ({
      subject: "the rebrand",
      body: `${greet(role)} — the Hartley & Finch rebrand looks sharp. Clearly gearing up for growth on the lettings side.

${
  role === "marketing"
    ? "New brand, same challenge: getting landlord instructions before the portals eat the margin."
    : "Every " +
      (role === "owners" ? "agency owner" : "director") +
      " we speak to says the same: winning landlord instructions is the whole game."
}

We put you in front of ${loc} landlords and vendors consistently — without buying portal leads everyone else gets too. Worth a 15-minute look?

— you (sent from your own inbox)`,
    }),
  },
];

// The demo pretends verification catches a realistic ~6% of bad addresses.
export const verifiedOf = (count: number) => Math.max(1, Math.round(count * 0.94));

// Note about first-name personalisation shown under the sample email.
export const EMAIL_CAPTION = `Sample draft with example data — in the app, Velox researches each real prospect (${firstNameNote}, their company, what they're doing right now) and writes from your business context.`;
