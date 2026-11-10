// Helpers for bulk lead upload: reading a CSV file, cleaning phone numbers and
// emails, and spotting duplicates. No React in here, so it is easy to test.

export type LeadLike = {
  name: string;
  email: string;
  phone: string;
  service: string;
  vendor: string;
};

export type VendorLike = { name: string; service: string; status: string };

/* ---------- Phone and email ---------- */

// "+91 90000 59978", "090000-59978", "9000059978" -> "9000059978"
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

// Indian mobile number: 10 digits starting with 6, 7, 8 or 9.
// Change this if you also need to accept numbers from other countries.
export function isValidPhone(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

export function formatPhone(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------- CSV reading ---------- */

// Turns CSV text into rows of cells. Handles quotes, commas inside quotes,
// Excel's hidden BOM character, and comma / semicolon / tab separated files.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  endRow();

  return rows;
}

// Builds CSV text (used for the template and the "skipped rows" report).
export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
        )
        .join(",")
    )
    .join("\r\n");
}

/* ---------- Reading the columns ---------- */

export type RawRow = {
  line: number; // line number in the file (header is line 1)
  name: string;
  phone: string;
  email: string;
  service: string;
  source: string;
  vendor: string;
};

const columnAliases: Record<keyof Omit<RawRow, "line">, string[]> = {
  name: ["name", "customer", "customername", "fullname"],
  phone: ["phone", "mobile", "phonenumber", "mobilenumber", "contact", "contactnumber", "whatsapp"],
  email: ["email", "emailid", "emailaddress", "mail", "mailid"],
  service: ["service", "interest", "interestedin", "requirement"],
  source: ["source", "leadsource"],
  vendor: ["vendor", "assignedvendor", "assignto", "vendorname"],
};

export function readLeadRows(text: string): { rows: RawRow[]; error: string } {
  const table = parseCsv(text);
  if (table.length < 2) {
    return { rows: [], error: "The file is empty, or has a header row but no leads." };
  }

  const headers = table[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const indexOf = (field: keyof typeof columnAliases) =>
    headers.findIndex((h) => columnAliases[field].includes(h));

  const index = {
    name: indexOf("name"),
    phone: indexOf("phone"),
    email: indexOf("email"),
    service: indexOf("service"),
    source: indexOf("source"),
    vendor: indexOf("vendor"),
  };

  if (index.name === -1 || (index.phone === -1 && index.email === -1)) {
    return {
      rows: [],
      error:
        'The first row must be a header with a "Name" column and a "Phone" or "Email" column. Use "Download template" to see the layout.',
    };
  }

  const cell = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? "").trim());

  const rows = table.slice(1).map((r, n) => ({
    line: n + 2,
    name: cell(r, index.name),
    phone: cell(r, index.phone),
    email: cell(r, index.email),
    service: cell(r, index.service),
    source: cell(r, index.source),
    vendor: cell(r, index.vendor),
  }));

  return { rows, error: "" };
}

export function matchService(raw: string, services: string[]): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const exact = services.find((s) => s.toLowerCase() === value);
  if (exact) return exact;

  const hints: [RegExp, string][] = [
    [/photo/, "Photography"],
    [/video|film|cinema/, "Videography"],
    [/wedding|plann|decor/, "Wedding Planning"],
    [/make|beauty|mua/, "Make-up Artist"],
  ];
  for (const [pattern, name] of hints) {
    if (pattern.test(value) && services.includes(name)) return name;
  }
  return null;
}

/* ---------- Duplicate check ---------- */

/*
 * Rules:
 *  - Same person  = same phone number OR same email (either one matches).
 *  - Same person + SAME service  -> "duplicate": skipped.
 *  - Same person + OTHER service -> "crosssell": allowed. This is the point of
 *    cross-selling: a wedding-card customer who now wants a photographer is a
 *    new lead for a photography vendor.
 *  - Same person twice inside the file for the same service -> "repeat": skipped.
 */
export type RowStatus = "new" | "crosssell" | "duplicate" | "repeat" | "invalid";

export type CheckedRow = {
  line: number;
  name: string;
  phone: string; // formatted, or what was typed if it was not a valid number
  email: string;
  service: string;
  source: string;
  vendor: string;
  status: RowStatus;
  reason: string;
};

export const canImport = (row: CheckedRow) =>
  row.status === "new" || row.status === "crosssell";

export type CheckOptions = {
  services: string[];
  existing: LeadLike[];
  vendors: VendorLike[];
  // Vendor upload: everything goes to this vendor, for this vendor's service.
  fixedVendor?: { name: string; service: string };
  // Admin upload: "auto" = balance by service, "unassigned", or a vendor name.
  assignment: string;
  // Admin sees which vendor already holds a duplicate; a vendor must not.
  revealHolder: boolean;
};

export function checkRows(raw: RawRow[], options: CheckOptions): CheckedRow[] {
  const { services, existing, vendors, fixedVendor, assignment, revealHolder } = options;

  const existingPhone = existing.map((l) => normalizePhone(l.phone));
  const existingEmail = existing.map((l) => normalizeEmail(l.email));

  // How many leads each vendor has, so "auto" gives new leads to whoever has
  // the fewest (kept up to date as this batch is handed out).
  const load = new Map<string, number>();
  existing.forEach((l) => load.set(l.vendor, (load.get(l.vendor) ?? 0) + 1));

  const seen = new Set<string>();

  return raw.map((r): CheckedRow => {
    const phoneDigits = normalizePhone(r.phone);
    const phoneOk = isValidPhone(phoneDigits);
    const email = normalizeEmail(r.email);
    const emailOk = isValidEmail(email);

    const base: CheckedRow = {
      line: r.line,
      name: r.name,
      phone: phoneOk ? formatPhone(phoneDigits) : r.phone,
      email: emailOk ? email : r.email,
      service: "",
      source: r.source,
      vendor: "",
      status: "invalid",
      reason: "",
    };
    const fail = (reason: string): CheckedRow => ({ ...base, reason });

    if (!r.name) return fail("Missing name");
    if (!phoneOk && !emailOk) return fail("Needs a valid phone number or email");

    // Which service is this lead for?
    let service: string | null;
    if (fixedVendor) {
      service = fixedVendor.service;
    } else if (r.service) {
      service = matchService(r.service, services);
      if (!service) return fail(`Unknown service "${r.service}"`);
    } else if (assignment !== "auto" && assignment !== "unassigned") {
      service = vendors.find((v) => v.name === assignment)?.service ?? null;
    } else {
      service = null;
    }
    if (!service) return fail("Service is missing");
    base.service = service;

    // Does this person already exist with us?
    const matches = existing.filter(
      (_l, i) =>
        (phoneOk && existingPhone[i] === phoneDigits) ||
        (emailOk && existingEmail[i] === email)
    );
    const sameService = matches.find((l) => l.service === service);

    if (sameService) {
      const holder = revealHolder
        ? `already a ${service} lead with ${sameService.vendor}`
        : `already in King of Cards as a ${service} lead`;
      return { ...base, status: "duplicate", reason: holder[0].toUpperCase() + holder.slice(1) };
    }

    // The same person twice in this file for the same service?
    const keys = [
      phoneOk ? `p:${phoneDigits}|${service}` : "",
      emailOk ? `e:${email}|${service}` : "",
    ].filter(Boolean);
    if (keys.some((k) => seen.has(k))) {
      return { ...base, status: "repeat", reason: "Appears twice in this file" };
    }

    // Who gets the lead?
    let vendor = "Unassigned";
    if (fixedVendor) {
      vendor = fixedVendor.name;
    } else if (r.vendor) {
      const named = vendors.find((v) => v.name.toLowerCase() === r.vendor.toLowerCase());
      if (!named) return fail(`Unknown vendor "${r.vendor}"`);
      if (named.service !== service) return fail(`${named.name} does not offer ${service}`);
      vendor = named.name;
    } else if (assignment === "auto") {
      const candidates = vendors.filter((v) => v.service === service && v.status === "Active");
      candidates.sort((a, b) => (load.get(a.name) ?? 0) - (load.get(b.name) ?? 0));
      if (candidates.length > 0) vendor = candidates[0].name;
    } else if (assignment !== "unassigned") {
      const chosen = vendors.find((v) => v.name === assignment);
      if (chosen && chosen.service !== service) {
        return fail(`${chosen.name} does not offer ${service}`);
      }
      vendor = chosen ? chosen.name : "Unassigned";
    }

    keys.forEach((k) => seen.add(k));
    load.set(vendor, (load.get(vendor) ?? 0) + 1);

    if (matches.length > 0) {
      return {
        ...base,
        vendor,
        status: "crosssell",
        reason: `Existing customer, new service (${service})`,
      };
    }
    return { ...base, vendor, status: "new", reason: "" };
  });
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}