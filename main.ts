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
const GEMINI_API_TARGET_BASE = "https://generativelanguage.googleapis.com"; // Base for Google's API

async function handler(req: Request): Promise<Response> {
  if (!GOOGLE_API_KEY) {
    console.error("CRITICAL: GOOGLE_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ error: "Server configuration error: API key missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const requestUrl = new URL(req.url);
  
  // The path from the client SDK will be like /v1beta/models/gemini-2.0-flash:generateContent
  // We need to append this path to GEMINI_API_TARGET_BASE
  const targetPath = requestUrl.pathname; // This should be the path the SDK intended for Google
  const targetSearchParams = requestUrl.searchParams.toString(); // Preserve query params if any

  // Construct the full target URL for Google's API
  // The SDK client should already be forming the correct path (e.g. /v1beta/models/...)
  // So we just prepend Google's base URL.
  let fullTargetUrl = `${GEMINI_API_TARGET_BASE}${targetPath}`;
  if (targetSearchParams) {
    fullTargetUrl += `?${targetSearchParams}`;
  }
  
  // IMPORTANT: Append the API key as a query parameter
  // This is how the generativelanguage.googleapis.com endpoint expects the key.
  const keySeparator = fullTargetUrl.includes("?") ? "&" : "?";
  fullTargetUrl += `${keySeparator}key=${GOOGLE_API_KEY}`;


  console.log(`[Forwarder] Received ${req.method} request for: ${requestUrl.pathname}`);
  console.log(`[Forwarder] Forwarding to Google API: ${fullTargetUrl.replace(GOOGLE_API_KEY, "GOOGLE_API_KEY_REDACTED")}`);

  try {
    let clientRequestBody: BodyInit | null = null;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        // Check if there's a body and if it's not already consumed
        if (req.body && !req.bodyUsed) {
            // Try to parse as JSON, but forward as is if not JSON
            const contentType = req.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                try {
                    const jsonData = await req.json();
                    clientRequestBody = JSON.stringify(jsonData);
                    // console.log(`[Forwarder] Forwarding JSON body: ${clientRequestBody}`);
                } catch (e) {
                    console.warn("[Forwarder] Could not parse incoming body as JSON, forwarding as text/blob if possible.");
                    clientRequestBody = await req.text(); // Or req.blob() if expecting binary
                }
            } else {
                 clientRequestBody = req.body; // Forward the stream directly
            }
        }
    }
    
    const geminiResponse = await fetch(fullTargetUrl, {
      method: req.method,
      headers: req.headers, // Forward most headers from the client
      body: clientRequestBody,
      redirect: "follow", // Let fetch handle redirects if any from Google
    });

    console.log(`[Forwarder] Google API response status: ${geminiResponse.status}`);

    // Create new headers for the response to the client, copying from Google's response
    const responseHeaders = new Headers(geminiResponse.headers);
    // Remove any Deno Deploy specific headers if necessary, or add CORS headers if needed
    // For simplicity, we're copying all headers.

    return new Response(geminiResponse.body, {
      status: geminiResponse.status,
      statusText: geminiResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("[Forwarder] Error during request forwarding:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to forward request to Gemini API",
        details: error.message,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }, // 502 Bad Gateway
    );
  }
}

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")!) : 8000;
console.log(`[Forwarder] Deno server starting on http://localhost:${port}`);
serve(handler, { port });