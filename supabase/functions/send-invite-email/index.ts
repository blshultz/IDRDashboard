import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/** Decode the JWT payload to verify the caller is authenticated. */
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

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ── POST only ───────────────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Authentication ──────────────────────────────────────────
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!decodeJwtEmail(jwt)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Secrets — must both be present ─────────────────────────
  const webhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
  if (!webhookUrl) {
    console.error("[send-invite-email] MAKE_WEBHOOK_URL is not set");
    return json({ error: "Email service is not configured. Contact your administrator." }, 503);
  }

  const makeApiKey = Deno.env.get("MAKE_API_KEY");
  if (!makeApiKey) {
    console.error("[send-invite-email] MAKE_API_KEY is not set");
    return json({ error: "Email service is not configured. Contact your administrator." }, 503);
  }

  // ── Parse request body ──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { email, displayName, providerName, inviteLink, expiresAt } = body as {
    email: string;
    displayName: string;
    providerName: string | null;
    inviteLink: string;
    expiresAt: string;
  };

  if (!email || !inviteLink) {
    return json({ error: "Missing required fields: email, inviteLink" }, 400);
  }

  const payload = {
    portal_name:   "BHAC IDR Revenue Portal",
    email,
    display_name:  displayName  ?? "",
    provider_name: providerName ?? "",
    invite_link:   inviteLink,
    expires_at:    expiresAt    ?? "",
  };

  // ── POST to Make webhook ────────────────────────────────────
  let makeRes: Response;
  try {
    makeRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-make-apikey": makeApiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[send-invite-email] fetch to Make failed:", err);
    return json({ error: `Failed to reach Make webhook: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const makeBody = await makeRes.text().catch(() => "");
  console.log(`[send-invite-email] Make responded ${makeRes.status}: ${makeBody}`);

  // ── Return result ───────────────────────────────────────────
  if (!makeRes.ok) {
    return json(
      { error: `Make webhook returned ${makeRes.status}`, makeStatus: makeRes.status, makeBody },
      makeRes.status,
    );
  }

  return json({ success: true });
});
