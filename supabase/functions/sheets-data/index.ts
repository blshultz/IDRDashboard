import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* ── JWT helper ─────────────────────────────────────────────── */

function decodeJwtEmail(jwt: string): string {
  try {
    const [, b64] = jwt.split(".");
    const padded = b64.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=");
    const payload = JSON.parse(atob(padded));
    return String(payload.email ?? "").toLowerCase();
  } catch {
    return "";
  }
}

/* ── Sheet parsing ──────────────────────────────────────────── */

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "" || val === false) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function deriveDateFromProcedureId(id: string): string {
  const m = id.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2].slice(0, 2)}-01` : new Date().toISOString().slice(0, 10);
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
  totalClaimsDeposited: number;
  totalAwardsDeposited: number;
  undepositedTotal: number;
  totalProviderExpected: number; // "Total Provider Expected" (= Net Awards Allowed − IDR commission, calculated in sheet)
  providerOwed: number;          // "Provider Payable"
  providerPaid: number;
  providerBalanceOwed: number;   // "Provider Open Balance"
  idrTeamCommission: number;
  bhacNetExpected: number;
  bhacRetainedToDate: number;
  bhacBalanceOwed: number;
}

function buildSheetRow(get: (name: string) => unknown): SheetRow {
  const procedureId = String(get("Procedure ID") ?? "").trim();
  const providerName = String(get("Provider Name") ?? get("Provider") ?? "").trim();
  return {
    procedureId,
    providerName,
    providerId: providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    date: deriveDateFromProcedureId(procedureId),
    claimNumber:          String(get("Claim #") ?? "").trim(),
    awardCode:            String(get("Award Code") ?? "").trim(),
    totalClaimPaid:       parseNumber(get("Total Claim Allowed")),
    totalAwards:          parseNumber(get("Total Awards Allowed")),
    procedureTotal:       parseNumber(get("Procedure Total")),
    totalDeposited:       parseNumber(get("Total Deposited")),
    totalClaimsDeposited: parseNumber(get("Total Claims Deposited")),
    totalAwardsDeposited: parseNumber(get("Total Awards Deposited")),
    undepositedTotal:     parseNumber(get("Undeposited Total")),
    totalProviderExpected: parseNumber(get("Total Provider Expected")),
    providerOwed:          parseNumber(get("Provider Payable")),
    providerPaid:          parseNumber(get("Provider Paid")),
    providerBalanceOwed:   parseNumber(get("Provider Open Balance")),
    idrTeamCommission:    parseNumber(get("IDR Team Commission")),
    bhacNetExpected:      parseNumber(get("BHAC Net Expected")),
    bhacRetainedToDate:   parseNumber(get("BHAC Retained to Date")),
    bhacBalanceOwed:      parseNumber(get("BHAC Balance Owed")),
  };
}

/** Handles two Apps Script response shapes:
 *  1. { rows: [{ "Column": value, ... }] }  ← named-object array (current)
 *  2. { values: [["Header", ...], [val, ...]] }  ← 2-D array (legacy)
 */
function parseResponse(data: Record<string, unknown>): SheetRow[] {
  if (Array.isArray(data.rows) && data.rows.length > 0 && typeof data.rows[0] === "object") {
    return (data.rows as Record<string, unknown>[])
      .filter(row => String(row["Procedure ID"] ?? "").trim())
      .map(row => buildSheetRow(name => row[name]));
  }
  const values = Array.isArray(data.values) ? data.values as unknown[][]
               : Array.isArray(data.rows)   ? data.rows   as unknown[][] : [];
  if (!values.length) return [];
  const hdrs = values[0].map(h => String(h ?? "").trim().toLowerCase());
  const col = (n: string) => hdrs.indexOf(n.toLowerCase());
  return values.slice(1)
    .filter(row => row.length > 0 && String(row[0] ?? "").trim())
    .map(row => buildSheetRow(name => { const i = col(name); return i === -1 ? undefined : row[i]; }));
}

/* ── Main handler ───────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── 1. Identify caller via JWT ──────────────────────────────
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const callerEmail = decodeJwtEmail(jwt);
    if (!callerEmail) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl     = Deno.env.get("SUPABASE_URL")      ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Query user_roles using the caller's own JWT (RLS allows own-row read)
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles` +
      `?select=role,provider_name,is_active&email=eq.${encodeURIComponent(callerEmail)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: supabaseAnonKey,
          Accept: "application/json",
        },
      }
    );
    const roleData = await roleRes.json() as { role: string; provider_name: string | null; is_active: boolean }[];
    const roleRow  = Array.isArray(roleData) ? roleData[0] : null;

    if (!roleRow || !roleRow.is_active) return json({ error: "Forbidden" }, 403);

    const isAdmin = roleRow.role === "admin";

    // ── 2. Fetch and parse Google Sheet data ────────────────────
    const appsScriptUrl = Deno.env.get("APPS_SCRIPT_URL")
      ?? "https://script.google.com/macros/s/AKfycbyrJrNILCE6rf1RqLE7ezyiQssbiU6c9gdPnl5U7Vm7SEjiRRELgDF8B5cqewB2kn_b/exec";

    const sheetRes = await fetch(appsScriptUrl, { redirect: "follow" });
    if (!sheetRes.ok) {
      throw new Error(`Apps Script error (${sheetRes.status}): ${await sheetRes.text()}`);
    }
    const sheetData = await sheetRes.json() as Record<string, unknown>;
    const allRows   = parseResponse(sheetData);

    // ── 3. ?providers=1 — return sorted unique provider names ───
    const url = new URL(req.url);
    if (url.searchParams.get("providers") === "1") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const providers = [...new Set(
        allRows.map(r => r.providerName.trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
      return json({ providers });
    }

    // ── 4. Filter rows: doctors see only their own provider ─────
    const rows = isAdmin
      ? allRows
      : allRows.filter(
          r => r.providerName.trim().toLowerCase() ===
               (roleRow.provider_name ?? "").trim().toLowerCase()
        );

    return json({ rows });

  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
