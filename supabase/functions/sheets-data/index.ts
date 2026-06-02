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

  // Doctor-facing fields — explicit column names, used for pending-receivable formula
  providerPayable: number;       // Sheet: "Provider Payable"
  totalProviderExpected: number; // Sheet: "Total Provider Expected"
  providerPaid: number;          // Sheet: "Provider Paid" (shared)
  providerOpenBalance: number;   // Sheet: "Provider Open Balance"

  // Admin aliases for the same collected-fund columns (kept for admin dashboard)
  providerOwed: number;          // same column as providerPayable
  providerBalanceOwed: number;   // same column as providerOpenBalance

  // BHAC admin calculations — do not use for doctor pending-receivable
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
    // Doctor-facing fields — parsed from their exact sheet column names
    providerPayable:       parseNumber(get("Provider Payable")),
    totalProviderExpected: parseNumber(get("Total Provider Expected")),
    providerPaid:          parseNumber(get("Provider Paid")),
    providerOpenBalance:   parseNumber(get("Provider Open Balance")),
    // Admin aliases (same sheet columns as the doctor fields above)
    providerOwed:          parseNumber(get("Provider Payable")),
    providerBalanceOwed:   parseNumber(get("Provider Open Balance")),
    idrTeamCommission:     parseNumber(get("IDR Team Commission")),
    bhacNetExpected:      parseNumber(get("BHAC Net Expected")),
    bhacRetainedToDate:   parseNumber(get("BHAC Retained to Date")),
    bhacBalanceOwed:      parseNumber(get("BHAC Balance Owed")),
  };
}

/** Handles two Apps Script response shapes:
 *  1. { rows: [{ "Column": value, ... }] }  ← named-object array (current)
 *  2. { values: [["Header", ...], [val, ...]] }  ← 2-D array (legacy)
 *
 *  Both paths use case-insensitive, trimmed header matching so that minor
 *  variations in the sheet header (trailing spaces, different capitalisation)
 *  don't silently return 0 for every field.
 */
function parseResponse(data: Record<string, unknown>): SheetRow[] {
  if (Array.isArray(data.rows) && data.rows.length > 0 && typeof data.rows[0] === "object") {
    const rawRows = data.rows as Record<string, unknown>[];

    // Log the exact column keys returned by the Apps Script so header-name
    // issues are visible in Supabase edge function logs.
    if (rawRows.length > 0) {
      const keys = Object.keys(rawRows[0]);
      console.log("[sheets-data] named-object column keys:", JSON.stringify(keys));
    }

    return rawRows
      .filter(row => {
        // Accept the row if ANY key (case-insensitive) matches "procedure id"
        const keys = Object.keys(row);
        const pidKey = keys.find(k => k.trim().toLowerCase() === "procedure id");
        return pidKey ? String(row[pidKey] ?? "").trim() : false;
      })
      .map(row => {
        // Build a normalised lookup once per row: "column header" → actual key
        const keyMap = new Map<string, string>();
        Object.keys(row).forEach(k => keyMap.set(k.trim().toLowerCase(), k));
        const get = (name: string): unknown => {
          const actual = keyMap.get(name.trim().toLowerCase());
          return actual !== undefined ? row[actual] : undefined;
        };
        return buildSheetRow(get);
      });
  }

  // 2-D array path (already uses lowercase header matching)
  const values = Array.isArray(data.values) ? data.values as unknown[][]
               : Array.isArray(data.rows)   ? data.rows   as unknown[][] : [];
  if (!values.length) return [];
  const hdrs = values[0].map(h => String(h ?? "").trim().toLowerCase());
  console.log("[sheets-data] 2-D array headers:", JSON.stringify(hdrs));
  const col = (n: string) => hdrs.indexOf(n.trim().toLowerCase());
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

    // ── 3. Debug: log pending-receivable fields for every row (edge-function logs)
    //    and expose a ?debug=1 admin endpoint for browser-side inspection ────
    const DEBUG_PROCEDURE_IDS = new Set([
      "m. lewis - 20251231",
      "o. maren - 2025126",
      "p. holifield - 20260214",
      "p. holifield - 20260515",
      "s. aoyagi - 20251229",
    ]);
    for (const r of allRows) {
      const pidLower = r.procedureId.toLowerCase();
      const isPinned = DEBUG_PROCEDURE_IDS.has(pidLower) ||
        // also log any row whose procedure-id contains one of the surnames
        ["lewis","maren","holifield","aoyagi"].some(n => pidLower.includes(n));
      if (isPinned) {
        const pending = Math.max(r.totalProviderExpected - r.providerPaid - r.providerBalanceOwed, 0);
        console.log(
          `[debug] procedureId="${r.procedureId}"` +
          ` provider="${r.providerName}"` +
          ` totalProviderExpected=${r.totalProviderExpected}` +
          ` providerPaid=${r.providerPaid}` +
          ` providerBalanceOwed=${r.providerBalanceOwed}` +
          ` → pendingReceivable=${pending}`
        );
      }
    }

    const url = new URL(req.url);

    // ?rawdump=1 — admin only. Returns the exact column keys from the sheet
    // AND the full unparsed raw object for every row whose Procedure ID
    // contains "lewis" (case-insensitive), plus a field-resolution report
    // showing exactly which key each target field name resolved to and what
    // raw value was found before any parseNumber() conversion.
    if (url.searchParams.get("rawdump") === "1") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

      const rawData = sheetData;
      let columnKeys: string[] = [];
      let targetRawRows: Record<string, unknown>[] = [];

      if (Array.isArray(rawData.rows) && rawData.rows.length > 0 && typeof rawData.rows[0] === "object") {
        const rawRows = rawData.rows as Record<string, unknown>[];
        columnKeys = Object.keys(rawRows[0]);

        // Find rows matching "lewis" in the Procedure ID (any key spelling)
        targetRawRows = rawRows.filter(row => {
          const keys = Object.keys(row);
          const pidKey = keys.find(k => k.trim().toLowerCase() === "procedure id");
          const pid = pidKey ? String(row[pidKey] ?? "") : "";
          return pid.toLowerCase().includes("lewis");
        });

        // For each target row, show the field-resolution report:
        // which key the target field names resolved to, and the raw value.
        const TARGET_FIELDS = [
          "Total Provider Expected",
          "Provider Paid",
          "Provider Open Balance",
        ];
        const fieldResolution = TARGET_FIELDS.map(fieldName => {
          const normalised = fieldName.trim().toLowerCase();
          // Find the actual key in the sheet that matches (after trim+lowercase)
          const actualKey = columnKeys.find(k => k.trim().toLowerCase() === normalised) ?? null;
          // Sample value from first matching target row
          const rawValue = actualKey && targetRawRows.length > 0
            ? targetRawRows[0][actualKey]
            : undefined;
          return {
            lookupName:   fieldName,
            actualKey,    // null if not found at all in the sheet
            rawValue,     // exact value before parseNumber()
            parsed:       rawValue === undefined || rawValue === null || rawValue === ""
                            ? 0
                            : parseNumber(rawValue),
          };
        });

        return json({
          columnKeys,         // every column header exactly as the sheet returned it
          targetRawRows,      // full unparsed row objects for "lewis" matches
          fieldResolution,    // lookup table: target field → actual key → raw value → parsed
          parsedMatchRows: allRows.filter(r => r.procedureId.toLowerCase().includes("lewis")),
        });
      }

      // 2-D array path
      if (Array.isArray(rawData.values) && (rawData.values as unknown[][]).length > 0) {
        const values = rawData.values as unknown[][];
        columnKeys = (values[0] as unknown[]).map(h => String(h ?? "").trim());
        return json({ columnKeys, note: "2-D array format; check header spelling in columnKeys" });
      }

      return json({ error: "Unrecognised sheet response format", keys: Object.keys(rawData) });
    }

    if (url.searchParams.get("debug") === "1") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const debugRows = allRows.map(r => {
        const pending = Math.max(r.totalProviderExpected - r.providerPaid - r.providerBalanceOwed, 0);
        return {
          procedureId:           r.procedureId,
          providerName:          r.providerName,
          totalProviderExpected: r.totalProviderExpected,
          providerPaid:          r.providerPaid,
          providerBalanceOwed:   r.providerBalanceOwed,
          pendingReceivable:     pending,
        };
      });
      return json({ debugRows });
    }

    // ── 4. ?providers=1 — return sorted unique provider names ───
    if (url.searchParams.get("providers") === "1") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const providers = [...new Set(
        allRows.map(r => r.providerName.trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
      return json({ providers });
    }

    // ── 5. Filter rows: doctors see only their own provider ─────
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
