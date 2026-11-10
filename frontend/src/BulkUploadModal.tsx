import { useMemo, useState, type ChangeEvent } from "react";
import {
  canImport,
  checkRows,
  downloadTextFile,
  readLeadRows,
  toCsv,
  type CheckedRow,
  type LeadLike,
  type RowStatus,
  type VendorLike,
} from "./leadUtils";
import "./BulkUpload.css";

// What the modal hands back for every lead that should be added.
export type NewLeadInput = {
  name: string;
  email: string;
  phone: string;
  service: string;
  source: string;
  vendor: string;
};

type Props = {
  // "Admin": upload leads and assign them to vendors.
  // "Vendor": a vendor uploads the leads they already have.
  mode: "Admin" | "Vendor";
  services: string[];
  vendors: VendorLike[];
  existingLeads: LeadLike[];
  currentVendor?: { name: string; service: string };
  // Admin only: every lead in the file goes to this one vendor
  // (used from the vendor's profile page).
  lockedVendor?: { name: string; service: string };
  onImport: (leads: NewLeadInput[]) => void;
  onClose: () => void;
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

const statusLabel: Record<RowStatus, string> = {
  new: "New",
  crosssell: "Cross-sell",
  duplicate: "Duplicate",
  repeat: "Repeat in file",
  invalid: "Invalid",
};

export default function BulkUploadModal({
  mode,
  services,
  vendors,
  existingLeads,
  currentVendor,
  lockedVendor,
  onImport,
  onClose,
}: Props) {
  const isAdmin = mode === "Admin";
  const isLocked = isAdmin && Boolean(lockedVendor);

  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [assignment, setAssignment] = useState(lockedVendor?.name ?? "auto");
  const [sourceLabel, setSourceLabel] = useState("");
  const [done, setDone] = useState<{ imported: number; skipped: CheckedRow[] } | null>(null);

  const parsed = useMemo(
    () => (csvText ? readLeadRows(csvText) : { rows: [], error: "" }),
    [csvText]
  );

  const tooManyRows = parsed.rows.length > MAX_ROWS;

  const checked = useMemo(() => {
    if (tooManyRows) return [];

    // When the upload is locked to one vendor, ignore any "Vendor" column in
    // the file so nothing can be sent to somebody else by mistake.
    const rows = isLocked
      ? parsed.rows.map((row) => ({ ...row, vendor: "" }))
      : parsed.rows;

    return checkRows(rows, {
      services,
      existing: existingLeads,
      vendors,
      fixedVendor: isAdmin ? undefined : currentVendor,
      assignment: isAdmin ? assignment : "fixed",
      revealHolder: isAdmin,
    });
  }, [parsed.rows, tooManyRows, services, existingLeads, vendors, isAdmin, isLocked, currentVendor, assignment]);

  const counts = {
    importable: checked.filter(canImport).length,
    crosssell: checked.filter((r) => r.status === "crosssell").length,
    duplicate: checked.filter((r) => r.status === "duplicate" || r.status === "repeat").length,
    invalid: checked.filter((r) => r.status === "invalid").length,
  };

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFileName("");
      setCsvText("");
      alert("This file is larger than 2 MB. Please split it into smaller files.");
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      alert('Please upload a .csv file. In Excel use "Save As" -> "CSV (Comma delimited)".');
      return;
    }

    setFileName(file.name);
    setCsvText(await file.text());
  }

  function downloadTemplate() {
    let header: string[];
    let example: string[];

    if (isLocked) {
      header = ["Name", "Phone", "Email", "Source"];
      example = ["Asha Rao", "98450 12345", "asha@example.com", "Wedding card order"];
    } else if (isAdmin) {
      header = ["Name", "Phone", "Email", "Service", "Source", "Vendor"];
      example = ["Asha Rao", "98450 12345", "asha@example.com", "Photography", "Wedding card order", ""];
    } else {
      header = ["Name", "Phone", "Email", "Source"];
      example = ["Asha Rao", "98450 12345", "asha@example.com", "My Instagram"];
    }

    downloadTextFile("leads-template.csv", toCsv([header, example]));
  }

  function downloadSkipped(rows: CheckedRow[]) {
    downloadTextFile(
      "skipped-leads.csv",
      toCsv([
        ["Line", "Name", "Phone", "Email", "Service", "Result", "Reason"],
        ...rows.map((r) => [
          String(r.line), r.name, r.phone, r.email, r.service, statusLabel[r.status], r.reason,
        ]),
      ])
    );
  }

  function runImport() {
    const toAdd = checked.filter(canImport);
    if (toAdd.length === 0) return;

    const label = sourceLabel.trim();
    onImport(
      toAdd.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone,
        service: r.service,
        vendor: r.vendor,
        source:
          r.source ||
          label ||
          (isAdmin ? "Bulk upload" : `Uploaded by ${currentVendor?.name ?? "vendor"}`),
      }))
    );
    setDone({ imported: toAdd.length, skipped: checked.filter((r) => !canImport(r)) });
  }

  const preview = checked.slice(0, 100);
  const showVendorColumn = isAdmin && !isLocked;

  const title = isLocked
    ? `Bulk Assign Leads to ${lockedVendor?.name}`
    : isAdmin
      ? "Bulk Upload & Assign Leads"
      : "Upload My Leads";

  const intro = isLocked
    ? `Upload a CSV file. Every new lead goes to ${lockedVendor?.name} (${lockedVendor?.service}). Customers who already exist for this service are skipped.`
    : isAdmin
      ? "Upload a CSV file. Customers who already exist (same phone or email) are caught before they are added, and new leads are given to vendors."
      : "Upload the customers you already have. Anyone already in King of Cards for your service is skipped, so nobody is called twice.";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="confirm-modal bulk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="bulk-title">{title}</h2>

        {done ? (
          <>
            <div className="bulk-done">
              <strong>{done.imported} lead{done.imported === 1 ? "" : "s"} added.</strong>
              <span>
                {done.skipped.length === 0
                  ? "Nothing was skipped."
                  : `${done.skipped.length} row${done.skipped.length === 1 ? " was" : "s were"} skipped (duplicates or invalid).`}
              </span>
            </div>

            <div className="modal-actions">
              {done.skipped.length > 0 && (
                <button className="button-secondary" onClick={() => downloadSkipped(done.skipped)}>
                  Download skipped rows
                </button>
              )}
              <button className="button-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p>{intro}</p>

            <div className="bulk-step">
              <div className="bulk-file-row">
                <label className="button-secondary bulk-file-button">
                  Choose CSV file
                  <input type="file" accept=".csv,.txt,text/csv" onChange={handleFile} hidden />
                </label>
                <span className="bulk-file-name">{fileName || "No file chosen"}</span>
                <button type="button" className="text-button" onClick={downloadTemplate}>
                  Download template
                </button>
              </div>

              {isAdmin && (
                <div className="form-grid">
                  {!isLocked && (
                    <label className="form-field">
                      <span>Assign new leads to</span>
                      <select value={assignment} onChange={(e) => setAssignment(e.target.value)}>
                        <option value="auto">Auto - spread across vendors by service</option>
                        <option value="unassigned">Leave unassigned</option>
                        {vendors.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.service})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className={`form-field ${isLocked ? "form-field-wide" : ""}`}>
                    <span>Lead source (if the file has none)</span>
                    <input
                      value={sourceLabel}
                      onChange={(e) => setSourceLabel(e.target.value)}
                      placeholder="e.g. Wedding card orders - Oct"
                    />
                  </label>
                </div>
              )}

              {isAdmin && !isLocked && (
                <p className="bulk-hint">
                  Columns: Name, Phone, Email, Service, Source, Vendor. A Vendor
                  value in the file overrides the choice above for that row.
                </p>
              )}

              {isLocked && (
                <p className="bulk-hint">
                  Columns: Name, Phone, Email, Source. The service and vendor are
                  filled in for you.
                </p>
              )}
            </div>

            {parsed.error && <div className="form-error" role="alert">{parsed.error}</div>}
            {tooManyRows && (
              <div className="form-error" role="alert">
                This file has more than {MAX_ROWS} rows. Please split it.
              </div>
            )}

            {checked.length > 0 && (
              <>
                <div className="bulk-summary">
                  <span className="ok"><strong>{counts.importable}</strong> will be added</span>
                  {counts.crosssell > 0 && (
                    <span className="info"><strong>{counts.crosssell}</strong> cross-sell</span>
                  )}
                  <span className="warn"><strong>{counts.duplicate}</strong> duplicates</span>
                  <span className="bad"><strong>{counts.invalid}</strong> invalid</span>
                </div>

                <div className="table-wrap bulk-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Line</th><th>Name</th><th>Phone</th><th>Service</th>
                        {showVendorColumn && <th>Vendor</th>}
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r.line}>
                          <td>{r.line}</td>
                          <td>{r.name || "-"}</td>
                          <td>{r.phone || r.email || "-"}</td>
                          <td>{r.service || "-"}</td>
                          {showVendorColumn && <td>{canImport(r) ? r.vendor : "-"}</td>}
                          <td>
                            <span className={`bulk-tag ${r.status}`}>{statusLabel[r.status]}</span>
                            {r.reason && <small className="bulk-reason">{r.reason}</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {checked.length > preview.length && (
                  <p className="bulk-hint">
                    Showing the first {preview.length} of {checked.length} rows. All rows are checked.
                  </p>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="button-secondary" onClick={onClose}>Cancel</button>
              <button
                className="button-primary"
                disabled={counts.importable === 0}
                onClick={runImport}
              >
                {counts.importable > 0 ? `Add ${counts.importable} leads` : "Add leads"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}