import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* ── Sheet parsing ──────────────────────────────────────────── */

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "" || val === false) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function deriveDateFromProcedureId(id: string): string {
  const match = id.match(/(\d{4})-(\d{2})/);
  if (match) {
    const year = match[1];
    const month = match[2].slice(0, 2);
    return `${year}-${month}-01`;
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
  totalClaimPaid: number;      // "Total Claim Allowed"
  totalAwards: number;          // "Total Awards Allowed"
  procedureTotal: number;       // "Procedure Total" (admin use)
  totalDeposited: number;       // "Total Deposited"
  totalClaimsDeposited: number; // "Total Claims Deposited"
  totalAwardsDeposited: number; // "Total Awards Deposited"
  undepositedTotal: number;
  providerOwed: number;         // "Provider Payable"
  providerPaid: number;
  providerBalanceOwed: number;  // "Provider Open Balance"
  idrTeamCommission: number;
  bhacNetExpected: number;
  bhacRetainedToDate: number;
  bhacBalanceOwed: number;
}

function buildSheetRow(get: (name: string) => unknown): SheetRow {
  const procedureId = String(get("Procedure ID") ?? "").trim();
  const providerName = String(get("Provider Name") ?? get("Provider") ?? "").trim();
  const providerId = providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = deriveDateFromProcedureId(procedureId);

  return {
    procedureId,
    providerName,
    providerId,
    date,
    claimNumber:          String(get("Claim #") ?? "").trim(),
    awardCode:            String(get("Award Code") ?? "").trim(),
    totalClaimPaid:       parseNumber(get("Total Claim Allowed")),
    totalAwards:          parseNumber(get("Total Awards Allowed")),
    procedureTotal:       parseNumber(get("Procedure Total")),
    totalDeposited:       parseNumber(get("Total Deposited")),
    totalClaimsDeposited: parseNumber(get("Total Claims Deposited")),
    totalAwardsDeposited: parseNumber(get("Total Awards Deposited")),
    undepositedTotal:     parseNumber(get("Undeposited Total")),
    providerOwed:         parseNumber(get("Provider Payable")),
    providerPaid:         parseNumber(get("Provider Paid")),
    providerBalanceOwed:  parseNumber(get("Provider Open Balance")),
    idrTeamCommission:    parseNumber(get("IDR Team Commission")),
    bhacNetExpected:      parseNumber(get("BHAC Net Expected")),
    bhacRetainedToDate:   parseNumber(get("BHAC Retained to Date")),
    bhacBalanceOwed:      parseNumber(get("BHAC Balance Owed")),
  };
}

/** Parse Apps Script response — handles two formats:
 *  1. Object array: data.rows = [{ "Column Name": value, ... }, ...]
 *  2. 2-D array:    data.values = [["Header1","Header2",...], [val1,val2,...], ...]
 */
function parseResponse(data: Record<string, unknown>): SheetRow[] {
  // Format 1: array of named objects (current Apps Script format)
  if (Array.isArray(data.rows) && data.rows.length > 0 && typeof data.rows[0] === "object") {
    return (data.rows as Record<string, unknown>[])
      .filter(row => String(row["Procedure ID"] ?? "").trim())
      .map(row => buildSheetRow(name => row[name]));
  }

  // Format 2: 2D array where row 0 is the header row
  const values = Array.isArray(data.values) ? data.values as unknown[][] :
                 Array.isArray(data.rows)   ? data.rows   as unknown[][] : [];
  if (values.length === 0) return [];

  const rawHeaders = values[0].map(h => String(h ?? "").trim().toLowerCase());
  const col = (name: string): number => rawHeaders.indexOf(name.toLowerCase());

  return values.slice(1)
    .filter(row => row.length > 0 && String(row[0] ?? "").trim())
    .map(row => buildSheetRow(name => {
      const i = col(name);
      return i === -1 ? undefined : row[i];
    }));
}

/* ── Main handler ───────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const appsScriptUrl = Deno.env.get("APPS_SCRIPT_URL")
      ?? "https://script.google.com/macros/s/AKfycbyrJrNILCE6rf1RqLE7ezyiQssbiU6c9gdPnl5U7Vm7SEjiRRELgDF8B5cqewB2kn_b/exec";

    const sheetRes = await fetch(appsScriptUrl, { redirect: "follow" });

    if (!sheetRes.ok) {
      const err = await sheetRes.text();
      throw new Error(`Apps Script error (${sheetRes.status}): ${err}`);
    }

    const data = await sheetRes.json() as Record<string, unknown>;

    if (debug) {
      const rawKeys = Object.keys(data);
      const rawRows = data.rows;
      const rawValues = data.values;
      return new Response(
        JSON.stringify({
          rawKeys,
          rowsType:   Array.isArray(rawRows)   ? `array[${(rawRows as unknown[]).length}]`   : typeof rawRows,
          valuesType: Array.isArray(rawValues) ? `array[${(rawValues as unknown[]).length}]` : typeof rawValues,
          rowsSample: Array.isArray(rawRows) ? (rawRows as unknown[]).slice(0, 2) : rawRows,
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = parseResponse(data);

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
