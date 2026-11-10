import type { ReactNode } from "react";
import {
  countActiveFilters,
  emptyFilters,
  type LeadFilters,
} from "./leadFilterLogic";
import "./LeadFilters.css";

export * from "./leadFilterLogic";

type Props = {
  // "Admin": every service and vendor. "Vendor": locked to their own service.
  mode: "Admin" | "Vendor";
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  // Called after "Clear filters", so the page can also clear its search box.
  onClear?: () => void;
  searchActive?: boolean;
  services: string[];
  vendors: { name: string; service: string }[];
  sources: string[];
  // Vendor mode: the one service this vendor offers.
  lockedService?: string;
  shown: number;
  total: number;
  // The page's own search box goes here.
  children?: ReactNode;
};

const stageChips: { value: string; hint: string }[] = [
  { value: "All", hint: "Every stage" },
  { value: "Pending", hint: "Called or WhatsApp - no decision yet" },
  { value: "Called", hint: "" },
  { value: "WhatsApp", hint: "" },
  { value: "Interested", hint: "" },
  { value: "Quotation Sent", hint: "" },
  { value: "Converted", hint: "" },
  { value: "Not Interested", hint: "" },
];

const serviceIcon: Record<string, string> = {
  Photography: "📷",
  Videography: "🎥",
  "Wedding Planning": "💍",
  "Make-up Artist": "💄",
};

export function LeadFilterBar({
  mode,
  filters,
  onChange,
  onClear,
  searchActive = false,
  services,
  vendors,
  sources,
  lockedService,
  shown,
  total,
  children,
}: Props) {
  const isAdmin = mode === "Admin";
  const activeCount = countActiveFilters(filters);

  // The vendor list only shows vendors of the chosen service.
  const vendorOptions = vendors.filter(
    (vendor) => filters.service === "All" || vendor.service === filters.service
  );

  function update(patch: Partial<LeadFilters>) {
    const next: LeadFilters = { ...filters, ...patch };

    // Picking a vendor also picks that vendor's service.
    if (patch.vendor !== undefined && patch.vendor !== "All") {
      const picked = vendors.find((vendor) => vendor.name === patch.vendor);
      if (picked) next.service = picked.service;
      if (next.assignment === "Unassigned") next.assignment = "All";
    }

    // Changing the service drops a vendor that does not belong to it.
    if (patch.service !== undefined && next.vendor !== "All") {
      const current = vendors.find((vendor) => vendor.name === next.vendor);
      if (current && next.service !== "All" && current.service !== next.service) {
        next.vendor = "All";
      }
    }

    // "Unassigned" and a named vendor can never both be true.
    if (patch.assignment === "Unassigned") next.vendor = "All";

    onChange(next);
  }

  function clearAll() {
    onChange(emptyFilters);
    onClear?.();
  }

  return (
    <div className="lead-filters">
      <div className="filter-row">
        {isAdmin ? (
          <>
            <label className="filter-field">
              <span>Service</span>
              <select
                value={filters.service}
                onChange={(event) => update({ service: event.target.value })}
              >
                <option value="All">All services</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Vendor</span>
              <select
                value={filters.vendor}
                onChange={(event) => update({ vendor: event.target.value })}
              >
                <option value="All">All vendors</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.name} value={vendor.name}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Assignment</span>
              <select
                value={filters.assignment}
                onChange={(event) =>
                  update({ assignment: event.target.value as LeadFilters["assignment"] })
                }
              >
                <option value="All">Assigned + unassigned</option>
                <option value="Assigned">Assigned to a vendor</option>
                <option value="Unassigned">Unassigned (waiting)</option>
              </select>
            </label>
          </>
        ) : (
          <div className="filter-field">
            <span>Your service</span>
            <div className="filter-locked">
              {serviceIcon[lockedService ?? ""] ?? "•"} {lockedService}
            </div>
          </div>
        )}

        <label className="filter-field">
          <span>Lead source</span>
          <select
            value={filters.source}
            onChange={(event) => update({ source: event.target.value })}
          >
            <option value="All">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        {children && <label className="filter-field filter-search"><span>Search</span>{children}</label>}
      </div>

      <div className="stage-chips" role="group" aria-label="Filter by stage">
        {stageChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            title={chip.hint || undefined}
            className={`stage-chip ${filters.stage === chip.value ? "active" : ""}`}
            onClick={() => update({ stage: chip.value })}
          >
            {chip.value}
          </button>
        ))}
      </div>

      <div className="filter-summary">
        <span>
          Showing <strong>{shown}</strong> of {total} leads
          {activeCount > 0 && ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} on`}
        </span>

        {(activeCount > 0 || searchActive) && (
          <button type="button" className="text-button" onClick={clearAll}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}