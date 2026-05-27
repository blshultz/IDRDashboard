import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* ── Sheet parsing ──────────────────────────────────────────── */

function parseNumber(val: string | undefined): number {
  if (!val) return 0;
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

function parseRows(values: unknown[][]): SheetRow[] {
  if (values.length === 0) return [];

  // Build a header-name → column-index map from row 0.
  // Matching is case-insensitive and trims whitespace so minor header edits
  // in the sheet don't break the parser.
  const rawHeaders = values[0].map(h => String(h ?? "").trim().toLowerCase());
  const col = (name: string): number => rawHeaders.indexOf(name.toLowerCase());

  return values.slice(1).filter(row => row.length > 0 && String(row[0] ?? "").trim()).map(row => {
    const get = (name: string): string => String(row[col(name)] ?? "").trim();

    const procedureId = get("Procedure ID") || String(row[0] ?? "").trim();
    // Try header-based lookup first; fall back to column B (index 1) in case the
    // sheet header doesn't exactly match "Provider Name".
    const providerName = get("Provider Name") || get("Provider") || String(row[1] ?? "").trim();
    const providerId = providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const date = deriveDateFromProcedureId(procedureId);

    return {
      procedureId,
      providerName,
      providerId,
      date,
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
    const values: unknown[][] = data.values ?? [];
    const rows = parseRows(values);

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
