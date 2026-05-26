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
  return values.slice(1).filter(row => row.length > 0 && String(row[0] ?? "").trim()).map(row => {
    const procedureId = String(row[0] ?? "").trim();
    const providerName = String(row[1] ?? "").trim();
    const providerId = providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const date = deriveDateFromProcedureId(procedureId);

    return {
      procedureId,
      providerName,
      providerId,
      date,
      totalClaimPaid: parseNumber(row[2] as string),
      totalAwards: parseNumber(row[3] as string),
      procedureTotal: parseNumber(row[4] as string),
      totalDeposited: parseNumber(row[5] as string),
      undepositedTotal: parseNumber(row[6] as string),
      providerOwed: parseNumber(row[7] as string),
      providerPaid: parseNumber(row[8] as string),
      providerBalanceOwed: parseNumber(row[9] as string),
      idrTeamCommission: parseNumber(row[10] as string),
      bhacNetExpected: parseNumber(row[11] as string),
      bhacRetainedToDate: parseNumber(row[12] as string),
      bhacBalanceOwed: parseNumber(row[13] as string),
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
