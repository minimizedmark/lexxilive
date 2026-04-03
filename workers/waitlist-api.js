/**
 * Cloudflare Worker: waitlist-api
 *
 * POST /api/waitlist
 * Body: { "email": "you@domain.com" }
 *
 * Env vars:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 *
 * Inserts into Supabase table: waitlist
 */

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Route
      if (url.pathname !== "/api/waitlist") {
        return json({ error: "Not found", path: url.pathname }, 404);
      }

      if (request.method !== "POST") {
        return json({ error: "Method not allowed", allowed: ["POST"] }, 405, {
          Allow: "POST"
        });
      }

      // Validate env
      const supabaseUrl = String(env?.SUPABASE_URL || "").trim();
      const supabaseAnonKey = String(env?.SUPABASE_ANON_KEY || "").trim();

      if (!supabaseUrl || !supabaseAnonKey) {
        return json(
          {
            error: "Server misconfigured",
            detail: "Missing SUPABASE_URL or SUPABASE_ANON_KEY"
          },
          500
        );
      }

      // Parse JSON
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const email = typeof body?.email === "string" ? body.email.trim() : "";
      if (!email) return json({ error: "Missing required field: email" }, 400);
      if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 422);

      // Supabase PostgREST insert
      const endpoint = new URL("/rest/v1/waitlist", supabaseUrl).toString();

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify({ email })
      });

      const raw = await resp.text();
      const data = raw ? safeJson(raw) : null;

      if (!resp.ok) {
        return json(
          {
            error: "Failed to insert into waitlist",
            supabase_status: resp.status,
            supabase_response: data
          },
          resp.status >= 400 && resp.status <= 599 ? resp.status : 502
        );
      }

      return json(
        { ok: true, message: "Added to waitlist", result: data },
        201
      );
    } catch (err) {
      return json(
        {
          error: "Internal server error",
          detail: err instanceof Error ? err.message : String(err)
        },
        500
      );
    }
  }
};

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isValidEmail(value) {
  // Reasonable validation (not RFC-perfect).
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}
