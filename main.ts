import { serve } from "https://deno.land/std@0.224.0/http/server.ts"; // Use a recent stable version
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
//
// Load .env for local development (Deno Deploy uses its own env var system)
if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
  try {
    await load({ export: true });
    console.log("Loaded .env file for local development.");
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.log("No .env file found, relying on system environment variables.");
    } else {
      console.error("Error loading .env file:", e);
    }
  }
}

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GEMINI_API_TARGET_BASE = Deno.env.get("GEMINI_API_TARGET_BASE") || "https://generativelanguage.googleapis.com";

console.log(`[Forwarder] Initializing...`);
console.log(`[Forwarder] GOOGLE_API_KEY first char: ${GOOGLE_API_KEY ? GOOGLE_API_KEY.substring(0,1) + '...' : 'Not Set'}`);
console.log(`[Forwarder] GEMINI_API_TARGET_BASE: ${GEMINI_API_TARGET_BASE}`);
if (!GOOGLE_API_KEY) {
  console.error("[Forwarder] CRITICAL STARTUP ERROR: GOOGLE_API_KEY is not set in the environment. Service will fail to forward requests properly.");
}

async function handler(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);

  // Health check or root path handling
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/favicon.ico") {
    return new Response("Gemini API Forwarder is running.", { status: 200 });
  }

  if (!GOOGLE_API_KEY) {
    console.error("CRITICAL: GOOGLE_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ error: "Server configuration error: API key missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Extract the path and query from the incoming request to the forwarder
  const targetPath = requestUrl.pathname + requestUrl.search;
  
  // Construct the full target URL for Google's API
  const fullTargetUrl = `${GEMINI_API_TARGET_BASE}${targetPath}`;

  // IMPORTANT: Append the API key as a query parameter
  const keySeparator = fullTargetUrl.includes("?") ? "&" : "?";
  const finalUrlWithKey = `${fullTargetUrl}${keySeparator}key=${GOOGLE_API_KEY}`;

  const loggedTargetUrl = GOOGLE_API_KEY 
    ? finalUrlWithKey.replace(GOOGLE_API_KEY, "GOOGLE_API_KEY_REDACTED")
    : finalUrlWithKey;

  console.log(`[Forwarder] >>> Forwarding to Google: ${req.method} ${loggedTargetUrl}`);

  try {
    let clientRequestBody: BodyInit | null = null;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      // Deno's fetch API handles streams, so we can directly pass the body
      clientRequestBody = req.body;
    }
    
    // We need to copy the headers to avoid issues with Deno's fetch
    const headersToGoogle = new Headers(req.headers);
    // You may need to remove some headers like 'host' or 'user-agent' if they cause issues
    // For now, let's keep it simple.

    const geminiResponse = await fetch(finalUrlWithKey, {
      method: req.method,
      headers: headersToGoogle,
      body: clientRequestBody,
      redirect: "follow",
    });

    console.log(`[Forwarder] <<< Google API response status: ${geminiResponse.status} ${geminiResponse.statusText}`);

    // Create new headers for the response to the client
    const responseHeaders = new Headers(geminiResponse.headers);

    return new Response(geminiResponse.body, {
      status: geminiResponse.status,
      statusText: geminiResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Forwarder] Error during request forwarding to Google API:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to forward request to Gemini API",
        details: error.message || "Unknown error",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")!) : 8000;
console.log(`[Forwarder] Deno server attempting to start on port: ${port}`);
serve(handler, {
  port: port,
  onListen({ port, hostname }) {
    console.log(`[Forwarder] ✅ Server successfully listening on http://${hostname}:${port}`);
  }
});
