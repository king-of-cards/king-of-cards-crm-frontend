// Numbers for the admin "Vendor Performance" report. No React in here.
//
// Two directions of leads move between King of Cards (KoC) and each vendor:
//   OUT: leads KoC gave the vendor      (origin is "King of Cards" or missing)
//   IN : leads the vendor gave to KoC   (origin is "Vendor", uploaded by them)
// "Converted" on an OUT lead = the vendor converted it.
// "Converted" on an IN lead  = King of Cards converted it.

export type PerfLead = {
  vendor: string;
  stage: string;
  origin?: "King of Cards" | "Vendor";
};

export type PerfVendor = { name: string; service: string };

export type Direction = {
  total: number;
  converted: number;
  interested: number;
  notInterested: number;
  open: number; // Called or WhatsApp: no decision yet
  rate: number; // converted out of total, as a percentage
};

export type VendorStats = {
  name: string;
  service: string;
  out: Direction; // we gave them
  into: Direction; // they gave us
  balance: number; // positive: we gave more, negative: they gave more
  advice: { key: string; text: string };
};

// A starting point for the "What to do" column. Change to match your business.
export const MIN_LEADS_FOR_JUDGEMENT = 10; // fewer leads than this = too early to say
export const GOOD_RATE = 15; // % converted or higher -> send more
export const LOW_RATE = 5; // % converted or lower  -> review before sending more

export function advice(given: number, rate: number) {
  if (given < MIN_LEADS_FOR_JUDGEMENT) return { key: "early", text: "Too early to judge" };
  if (rate >= GOOD_RATE) return { key: "more", text: "Send more leads" };
  if (rate < LOW_RATE) return { key: "review", text: "Review before sending more" };
  return { key: "steady", text: "Keep steady" };
}

export function directionOf(list: PerfLead[]): Direction {
  const count = (stage: string) => list.filter((l) => l.stage === stage).length;
  const converted = count("Converted");
  return {
    total: list.length,
    converted,
    interested: count("Interested"),
    notInterested: count("Not Interested"),
    open: count("Called") + count("WhatsApp"),
    rate: list.length ? (converted / list.length) * 100 : 0,
  };
}

export function buildVendorStats(
  leads: PerfLead[],
  vendors: PerfVendor[],
  service: string
): VendorStats[] {
  return vendors
    .filter((v) => service === "All" || v.service === service)
    .map((v) => {
      const mine = leads.filter((l) => l.vendor === v.name);
      const out = directionOf(mine.filter((l) => l.origin !== "Vendor"));
      const into = directionOf(mine.filter((l) => l.origin === "Vendor"));
      return {
        name: v.name,
        service: v.service,
        out,
        into,
        balance: out.total - into.total,
        advice: advice(out.total, out.rate),
      };
    })
    .sort((a, b) => b.out.rate - a.out.rate || b.out.total - a.out.total);
}

// Adds every vendor's numbers together (the "All vendors" row and the cards).
export function totalOf(rows: VendorStats[]) {
  const add = (pick: (r: VendorStats) => Direction): Direction => {
    const sum = (key: keyof Direction) =>
      rows.reduce((acc, r) => acc + pick(r)[key], 0);
    const total = sum("total");
    const converted = sum("converted");
    return {
      total,
      converted,
      interested: sum("interested"),
      notInterested: sum("notInterested"),
      open: sum("open"),
      rate: total ? (converted / total) * 100 : 0,
    };
  };
  return { out: add((r) => r.out), into: add((r) => r.into) };
}