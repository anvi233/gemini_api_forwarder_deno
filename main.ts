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
  const incomingHeadersForLog: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    incomingHeadersForLog[key] = value;
  });
  console.log(
    `[Forwarder] <<< Incoming Request: ${req.method} ${req.url}`
    // `Headers: ${JSON.stringify(incomingHeadersForLog)}` // Can be too verbose, uncomment if needed
  );

  if (!GOOGLE_API_KEY) {
    console.error("CRITICAL: GOOGLE_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ error: "Server configuration error: API key missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const requestUrl = new URL(req.url);

  // Handle simple root path requests (e.g., browser access or health checks)
  if (requestUrl.pathname === "/" && req.method === "GET") {
    console.log("[Forwarder] Received GET request for root path. Performing Deno-to-Gemini test call.");

    if (!GOOGLE_API_KEY) {
       console.error("[Forwarder] GOOGLE_API_KEY is not set. Cannot perform Deno-to-Gemini test.");
       return new Response(
         "Deno-to-Gemini test failed: Server configuration error (API key missing).",
         { status: 500, headers: { "Content-Type": "text/plain" } },
       );
    }

    const testModel = "gemini-2.0-flash"; // Use a small, fast model for the test
    const testPrompt = "Tell me a very short fun fact about Deno itself."; // Changed prompt slightly
    const testApiEndpoint = `${GEMINI_API_TARGET_BASE}/v1beta/models/${testModel}:generateContent`;
    const testFullUrl = `${testApiEndpoint}?key=${GOOGLE_API_KEY}`;

    const testRequestBody = {
      contents: [{ parts: [{ text: testPrompt }] }],
      generationConfig: { maxOutputTokens: 100 }, // Limit response length
    };

    console.log(`[Forwarder] >>> Sending test POST request from Deno to Google API: ${testApiEndpoint.replace(GEMINI_API_TARGET_BASE, '...').substring(0, testApiEndpoint.indexOf(':') + 1)}...`);

    try {
      const testResponse = await fetch(testFullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testRequestBody),
      });

      console.log(`[Forwarder] <<< Received test response status from Google API: ${testResponse.status} ${testResponse.statusText}`);

      let responseBodyText = "Could not read response body.";
      try {
         const responseBody = await testResponse.json();
         responseBodyText = JSON.stringify(responseBody, null, 2); // Pretty print JSON
      } catch (e) {
         responseBodyText = await testResponse.text(); // Fallback to text if not JSON
         console.warn("[Forwarder] Deno-to-Gemini test: Could not parse Google response as JSON, reading as text.", e.message);
      }

      if (testResponse.ok) { // Status code 2xx
        console.log("[Forwarder] Deno-to-Gemini test call SUCCESS.");
        return new Response(
          `Deno-to-Gemini test call SUCCESS!\nStatus: ${testResponse.status}\nResponse Body:\n${responseBodyText}`,
          { status: 200, headers: { "Content-Type": "text/plain" } },
        );
      } else { // Status code 4xx or 5xx
        console.error("[Forwarder] Deno-to-Gemini test call FAILED with status:", testResponse.status);
        return new Response(
          `Deno-to-Gemini test call FAILED!\nStatus: ${testResponse.status}\nResponse Body:\n${responseBodyText}`,
          { status: testResponse.status, headers: { "Content-Type": "text/plain" } },
        );
      }
    } catch (error) {
      console.error("[Forwarder] Error during Deno-to-Gemini test fetch:", error);
      return new Response(
        `Deno-to-Gemini test call ERROR!\nDetails: ${error.message || 'Unknown error'}`,
        { status: 500, headers: { "Content-Type": "text/plain" } },
      );
    }

    // Fallback response if somehow none of the above return
    return new Response(
      "Gemini API Forwarder is running. Deno-to-Gemini test logic executed but did not explicitly return.",
      { status: 200, headers: { "Content-Type": "text/plain" } },
    );
  }

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
  // Safer redaction for logging
  const loggedTargetUrl = GOOGLE_API_KEY 
    ? fullTargetUrl.replace(GOOGLE_API_KEY, "GOOGLE_API_KEY_REDACTED")
    : fullTargetUrl;
  // console.log(`[Forwarder] Forwarding to Google API: ${loggedTargetUrl}`); // Old log
  console.log(
    `[Forwarder] >>> Forwarding to Google: ${req.method} ${loggedTargetUrl.substring(0, loggedTargetUrl.indexOf('?key=') + 5)}GOOGLE_API_KEY_REDACTED`
  );

  try {
    let clientRequestBody: BodyInit | null = null;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        // Check if there's a body and if it's not already consumed
        if (req.body && !req.bodyUsed) {
            // Try to parse as JSON, but forward as is if not JSON
            const contentType = req.headers.get("content-type")?.toLowerCase();
            if (contentType && contentType.includes("application/json")) {
                const rawBody = await req.text(); // Read body as text first
                try {
                    JSON.parse(rawBody); // Validate if it's JSON by attempting to parse
                    clientRequestBody = rawBody; // Forward the original raw body (which is valid JSON text)
                    // console.log(`[Forwarder] Forwarding JSON body: ${clientRequestBody}`);
                } catch (e) {
                    console.warn(
                        "[Forwarder] Incoming body declared as JSON but failed to parse. Forwarding as raw text. Error:",
                        e.message // Log only the error message for brevity
                    );
                    clientRequestBody = rawBody; // Forward the raw text anyway, as the client sent it
                }
            } else {
                 clientRequestBody = req.body; // Forward the stream directly
            }
        }
    }
    
    const headersToGoogle = new Headers(req.headers); // Start with client headers
    // Potentially remove or modify certain headers before forwarding if needed
    // e.g., headersToGoogle.delete('host'); // Deno's fetch will set the correct host

    const geminiResponse = await fetch(fullTargetUrl, {
      method: req.method,
      headers: headersToGoogle, // Forward (potentially modified) headers
      body: clientRequestBody,
      redirect: "follow", // Let fetch handle redirects if any from Google
    });

    console.log(`[Forwarder] <<< Google API response status: ${geminiResponse.status} ${geminiResponse.statusText}`);

    // Create new headers for the response to the client, copying from Google's response
    const responseHeaders = new Headers(geminiResponse.headers);
    // console.log("[Forwarder] Headers received from Google:", Object.fromEntries(responseHeaders.entries())); // Uncomment for debugging
    // Remove any Deno Deploy specific headers if necessary, or add CORS headers if needed
    // For simplicity, we're copying all headers.

    return new Response(geminiResponse.body, {
      status: geminiResponse.status,
      statusText: geminiResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("[Forwarder] Error during request forwarding to Google API:", error);
    if (error.cause) {
      console.error("[Forwarder] Error Cause:", error.cause);
    }
    return new Response(
      JSON.stringify({
        error: "Failed to forward request to Gemini API",
        details: error.message || "Unknown error",
        cause: error.cause ? String(error.cause) : "No cause provided"
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }, // 502 Bad Gateway
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