import { useMemo, useState } from "react";
import {
  GOOD_RATE,
  LOW_RATE,
  MIN_LEADS_FOR_JUDGEMENT,
  buildVendorStats,
  totalOf,
  type Direction,
  type PerfLead,
  type PerfVendor,
} from "./vendorStats";
import "./BulkUpload.css";
import "./VendorPerformance.css";

type Props = {
  leads: PerfLead[];
  vendors: PerfVendor[];
  services: string[];
  onOpenVendor: (vendorName: string) => void;
};

function rateCell(d: Direction) {
  return (
    <>
      <div className="perf-bar" title={`${d.converted} of ${d.total}`}>
        <span style={{ width: `${Math.min(d.rate, 100)}%` }} />
      </div>
      <small>{d.total ? `${d.rate.toFixed(1)}%` : "-"}</small>
    </>
  );
}

function balanceText(balance: number) {
  if (balance === 0) return "Even";
  return balance > 0 ? `We gave ${balance} more` : `They gave ${-balance} more`;
}

// Admin only: this report is shown on the admin Reports page and nowhere else.
export default function VendorPerformance({ leads, vendors, services, onOpenVendor }: Props) {
  const [service, setService] = useState("All");

  const rows = useMemo(
    () => buildVendorStats(leads, vendors, service),
    [leads, vendors, service]
  );

  const totals = totalOf(rows);
  const best = rows.find((r) => r.out.total >= MIN_LEADS_FOR_JUDGEMENT && r.out.converted > 0);
  const topGiver = [...rows].sort((a, b) => b.into.total - a.into.total)[0];
  const unassigned = leads.filter((l) => l.vendor === "Unassigned").length;

  return (
    <section className="vendor-page">
      <div className="section-heading">
        <div>
          <h2>Vendor Performance</h2>
          <p>Leads we gave each vendor, leads they gave us, and how many of each became customers.</p>
        </div>

        <label className="filter-control">
          <span>Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="All">All services</option>
            {services.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="perf-summary">
        <div className="perf-group out">
          <h3>We gave vendors</h3>
          <div className="perf-cards">
            <article className="vendor-lead-kpi"><span>Leads given</span><strong>{totals.out.total}</strong></article>
            <article className="vendor-lead-kpi"><span>Vendors converted</span><strong>{totals.out.converted}</strong></article>
            <article className="vendor-lead-kpi"><span>Conversion rate</span><strong>{totals.out.rate.toFixed(1)}%</strong></article>
            <article className="vendor-lead-kpi"><span>Best vendor</span><strong className="perf-best">{best ? best.name : "-"}</strong></article>
          </div>
        </div>

        <div className="perf-group in">
          <h3>Vendors gave us</h3>
          <div className="perf-cards">
            <article className="vendor-lead-kpi"><span>Leads received</span><strong>{totals.into.total}</strong></article>
            <article className="vendor-lead-kpi"><span>We converted</span><strong>{totals.into.converted}</strong></article>
            <article className="vendor-lead-kpi"><span>Conversion rate</span><strong>{totals.into.rate.toFixed(1)}%</strong></article>
            <article className="vendor-lead-kpi"><span>Top giver</span><strong className="perf-best">{topGiver && topGiver.into.total > 0 ? topGiver.name : "-"}</strong></article>
          </div>
        </div>
      </div>

      <section className="panel vendor-leads-panel">
        <div className="table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th rowSpan={2}>Vendor</th>
                <th colSpan={4} className="perf-head out">We gave them</th>
                <th colSpan={4} className="perf-head in">They gave us</th>
                <th rowSpan={2}>Balance</th>
                <th rowSpan={2}>What to do</th>
              </tr>
              <tr>
                <th>Leads</th>
                <th>They converted</th>
                <th>Rate</th>
                <th>Still open</th>
                <th>Leads</th>
                <th>We converted</th>
                <th>Rate</th>
                <th>Still open</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="clickable-lead-row" onClick={() => onOpenVendor(r.name)}>
                  <td>
                    <strong>{r.name}</strong>
                    <small className="bulk-reason">{r.service}</small>
                  </td>
                  <td>{r.out.total}</td>
                  <td>{r.out.converted}</td>
                  <td>{rateCell(r.out)}</td>
                  <td>{r.out.open}</td>
                  <td>{r.into.total}</td>
                  <td>{r.into.converted}</td>
                  <td>{rateCell(r.into)}</td>
                  <td>{r.into.open}</td>
                  <td>{balanceText(r.balance)}</td>
                  <td><span className={`perf-advice ${r.advice.key}`}>{r.advice.text}</span></td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr><td colSpan={11} className="empty-state">No vendors to show.</td></tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td><strong>All vendors</strong></td>
                  <td>{totals.out.total}</td>
                  <td>{totals.out.converted}</td>
                  <td>{rateCell(totals.out)}</td>
                  <td>{totals.out.open}</td>
                  <td>{totals.into.total}</td>
                  <td>{totals.into.converted}</td>
                  <td>{rateCell(totals.into)}</td>
                  <td>{totals.into.open}</td>
                  <td>{balanceText(totals.out.total - totals.into.total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="table-footer">
          <span>
            "They converted" = leads we gave that reached Converted. "We converted" = leads they gave us that reached Converted.
            "Still open" = Called or WhatsApp, not yet decided.
          </span>
          <span>
            Send more at {GOOD_RATE}%+ · Review below {LOW_RATE}% · Needs at least {MIN_LEADS_FOR_JUDGEMENT} leads to judge.
            {unassigned > 0 && ` ${unassigned} leads are unassigned.`}
          </span>
        </div>
      </section>
    </section>
  );
}