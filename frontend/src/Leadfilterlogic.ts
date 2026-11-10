// Filtering rules shared by the admin and vendor dashboards.
// No React in here, so it is easy to test and to reuse in the Java backend later.

export type Assignment = "All" | "Assigned" | "Unassigned";

export type LeadFilters = {
  service: string; // "All" or a service name
  vendor: string; // "All" or a vendor name
  assignment: Assignment; // Assigned = has a vendor, Unassigned = waiting for one
  stage: string; // "All", "Pending", or one stage
  source: string; // "All" or a lead source
};

export const emptyFilters: LeadFilters = {
  service: "All",
  vendor: "All",
  assignment: "All",
  stage: "All",
  source: "All",
};

// "Pending" = the customer has been contacted but has not decided yet.
// Change this list if your business counts pending differently.
export const PENDING_STAGES = ["Called", "WhatsApp"];

export type FilterableLead = {
  service: string;
  vendor: string;
  stage: string;
  source: string;
};

export function applyLeadFilters<T extends FilterableLead>(
  list: T[],
  filters: LeadFilters
): T[] {
  return list.filter((lead) => {
    if (filters.service !== "All" && lead.service !== filters.service) return false;
    if (filters.vendor !== "All" && lead.vendor !== filters.vendor) return false;

    const unassigned = lead.vendor === "Unassigned";
    if (filters.assignment === "Assigned" && unassigned) return false;
    if (filters.assignment === "Unassigned" && !unassigned) return false;

    if (filters.stage === "Pending") {
      if (!PENDING_STAGES.includes(lead.stage)) return false;
    } else if (filters.stage !== "All" && lead.stage !== filters.stage) {
      return false;
    }

    if (filters.source !== "All" && lead.source !== filters.source) return false;

    return true;
  });
}

export function countActiveFilters(filters: LeadFilters): number {
  return (Object.keys(filters) as (keyof LeadFilters)[]).filter(
    (key) => filters[key] !== "All"
  ).length;
}