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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Require a valid authenticated session
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!decodeJwtEmail(jwt)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Webhook URL lives only in the edge function's environment — never in the client bundle
  const webhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
  if (!webhookUrl) {
    console.error("MAKE_WEBHOOK_URL is not set in edge function secrets");
    return json({ error: "Email service is not configured. Contact your administrator." }, 503);
  }

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
    display_name:  displayName ?? "",
    provider_name: providerName ?? "",
    invite_link:   inviteLink,
    expires_at:    expiresAt ?? "",
  };

  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Make webhook responded ${res.status}: ${text}`);
      return json({ error: `Webhook responded with status ${res.status}` }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("Failed to reach Make webhook:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
