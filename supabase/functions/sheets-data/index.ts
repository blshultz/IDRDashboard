import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* ── Shared helpers ─────────────────────────────────────────── */

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "" || val === false) return 0;
  const cleaned = String(val).replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function deriveDateFromProcedureId(id: string): string {
  const match = id.match(/(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2].slice(0, 2)}-01`;
  }
  return new Date().toISOString().slice(0, 10);
}

interface SheetRow {
  procedureId: string;
  providerName: string;
  providerId: string;
  date: string;
  claimNumber: string;
  awardCode: string;
  totalClaimPaid: number;
  totalAwards: number;
  procedureTotal: number;
  totalDeposited: number;
  undepositedTotal: number;
  providerOwed: number;
  providerPaid: number;
  providerBalanceOwed: number;
  idrTeamCommission: number;
  bhacNetExpected: number;
  bhacRetainedToDate: number;
  bhacBalanceOwed: number;
}

/* ── Format A: { rows: [{ "Procedure ID": ..., "Provider Name": ... }] }
      The newer Apps Script already maps columns to named keys. ─────── */

function parseObjectRows(rawRows: Record<string, unknown>[]): SheetRow[] {
  return rawRows
    .filter(row => String(row["Procedure ID"] ?? "").trim())
    .map(row => {
      const get = (key: string): string => String(row[key] ?? "").trim();
      const procedureId = get("Procedure ID");
      const providerName = get("Provider Name");
      const providerId = providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return {
        procedureId,
        providerName,
        providerId,
        date:                deriveDateFromProcedureId(procedureId),
        claimNumber:         get("Claim #"),
        awardCode:           get("Award Code"),
        totalClaimPaid:      parseNumber(row["Total Claim Paid"]),
        totalAwards:         parseNumber(row["Total Awards"]),
        procedureTotal:      parseNumber(row["Procedure Total"]),
        totalDeposited:      parseNumber(row["Total Deposited"]),
        undepositedTotal:    parseNumber(row["Undeposited Total"]),
        providerOwed:        parseNumber(row["Provider Owed"]),
        providerPaid:        parseNumber(row["Provider Paid"]),
        providerBalanceOwed: parseNumber(row["Provider Balance Owed"]),
        idrTeamCommission:   parseNumber(row["IDR Team Commission"]),
        bhacNetExpected:     parseNumber(row["BHAC Net Expected"]),
        bhacRetainedToDate:  parseNumber(row["BHAC Retained to Date"]),
        bhacBalanceOwed:     parseNumber(row["BHAC Balance Owed"]),
      };
    });
}

/* ── Format B: { values: [["Procedure ID", ...], ["A. Rose", ...]] }
      The older Apps Script returns a 2-D array with a header row.  ── */

function parse2DRows(values: unknown[][]): SheetRow[] {
  if (values.length === 0) return [];
  const rawHeaders = values[0].map(h => String(h ?? "").trim().toLowerCase());
  const col = (name: string): number => rawHeaders.indexOf(name.toLowerCase());

  return values.slice(1)
    .filter(row => row.length > 0 && String(row[0] ?? "").trim())
    .map(row => {
      const get = (name: string): string => String(row[col(name)] ?? "").trim();
      const procedureId = get("Procedure ID") || String(row[0] ?? "").trim();
      const providerName = get("Provider Name") || get("Provider") || String(row[1] ?? "").trim();
      const providerId = providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return {
        procedureId,
        providerName,
        providerId,
        date:                deriveDateFromProcedureId(procedureId),
        claimNumber:         get("Claim #"),
        awardCode:           get("Award Code"),
        totalClaimPaid:      parseNumber(get("Total Claim Paid")),
        totalAwards:         parseNumber(get("Total Awards")),
        procedureTotal:      parseNumber(get("Procedure Total")),
        totalDeposited:      parseNumber(get("Total Deposited")),
        undepositedTotal:    parseNumber(get("Undeposited Total")),
        providerOwed:        parseNumber(get("Provider Owed")),
        providerPaid:        parseNumber(get("Provider Paid")),
        providerBalanceOwed: parseNumber(get("Provider Balance Owed")),
        idrTeamCommission:   parseNumber(get("IDR Team Commission")),
        bhacNetExpected:     parseNumber(get("BHAC Net Expected")),
        bhacRetainedToDate:  parseNumber(get("BHAC Retained to Date")),
        bhacBalanceOwed:     parseNumber(get("BHAC Balance Owed")),
      };
    });
}

/* ── Main handler ───────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const appsScriptUrl = Deno.env.get("APPS_SCRIPT_URL")
      ?? "https://script.google.com/macros/s/AKfycbyrJrNILCE6rf1RqLE7ezyiQssbiU6c9gdPnl5U7Vm7SEjiRRELgDF8B5cqewB2kn_b/exec";

    const sheetRes = await fetch(appsScriptUrl, { redirect: "follow" });

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      throw new Error(`Apps Script error (${sheetRes.status}): ${err}`);
    }

    const data = await sheetRes.json();

    // Detect which format the Apps Script returned and parse accordingly.
    let rows: SheetRow[];
    if (Array.isArray(data.rows) && data.rows.length > 0 && !Array.isArray(data.rows[0])) {
      // Format A: array of objects
      rows = parseObjectRows(data.rows as Record<string, unknown>[]);
    } else if (Array.isArray(data.values)) {
      // Format B: 2-D array with header row
      rows = parse2DRows(data.values as unknown[][]);
    } else {
      rows = [];
    }

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
