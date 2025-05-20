# Gemini API Forwarder (Deno)

This is a simple Deno application that acts as a forwarder/proxy for Google Gemini API requests.
It allows applications in restricted network environments to access the Gemini API by routing requests through this deployed service.

## Features

- Receives requests intended for the Gemini API.
- Appends the `GOOGLE_API_KEY` (configured as an environment variable on the server).
- Forwards requests to the official Google Generative Language API endpoint.
- Returns the response from the Gemini API back to the original caller.

## Setup

### Environment Variables

The forwarder requires the following environment variable to be set (e.g., in Deno Deploy settings or a local `.env` file for testing):

- `GOOGLE_API_KEY`: Your Google API key for accessing the Gemini API.

### Local Development

1. Install Deno: https://deno.land/#installation
2. Create a `.env` file in the project root and add your `GOOGLE_API_KEY`:

   ```
   GOOGLE_API_KEY=AIzaSyYOUR_ACTUAL_API_KEY
   ```
3. Run the server:

   ```bash
   deno run --allow-net --allow-env main.ts
   ```

   The server will typically start on `http://localhost:8000`.

### Deployment (Deno Deploy)

1. Create a new project on Deno Deploy.
2. Link your GitHub repository containing this project.
3. In the Deno Deploy project settings, add an environment variable:
   - `Name`: `GOOGLE_API_KEY`
   - `Value`: Your actual Google API key.
4. Deno Deploy will automatically build and deploy your `main.ts` file. You will get a public URL (e.g., `https://your-project-name.deno.dev`).

## Usage

Your client applications (e.g., Python scripts using the `google-genai` SDK) should be configured to send their Gemini API requests to this forwarder's URL instead of the default Google API endpoint.

For the `google-genai` Python SDK, this is typically done by setting the `api_endpoint` in `client_options` when creating the `genai.Client`:

```python
import google.genai as genai
import os

DENO_FORWARDER_BASE_URL = "https://your-project-name.deno.dev" # Replace with your Deno Deploy URL
# The path after the base URL should match what the Gemini SDK expects,
# and your Deno forwarder should strip any custom prefix if needed.
# The google-genai SDK will append paths like /v1beta/models/gemini-2.0-flash:generateContent
# So, the api_endpoint should be the base part that the SDK will append to.
# If your Deno forwarder handles requests at its root that correspond to the SDK's expected paths,
# then DENO_FORWARDER_BASE_URL is correct.
# If your Deno forwarder has a prefix like /forward, adjust accordingly.

client_options = {"api_endpoint": DENO_FORWARDER_BASE_URL}
api_key_for_client = os.environ.get("GOOGLE_API_KEY") # Or a dummy key if Deno handles auth

client = genai.Client(api_key=api_key_for_client, client_options=client_options)

# Example call:
# response = client.models.generate_content(
#     model="models/gemini-2.0-flash", # SDK might prepend "models/" or expect it
#     contents=["Hello from client!"]
# )
# print(response.text)
```

# Gemini API Forwarder (Deno)

This is a simple Deno application that acts as a forwarder/proxy for Google Gemini API requests.
It allows applications in restricted network environments to access the Gemini API by routing requests through this deployed service.

## Features

- Receives requests intended for the Gemini API.
- Appends the `GOOGLE_API_KEY` (configured as an environment variable on the server).
- Forwards requests to the official Google Generative Language API endpoint.
- Returns the response from the Gemini API back to the original caller.

## Setup

### Environment Variables

The forwarder requires the following environment variable to be set (e.g., in Deno Deploy settings or a local `.env` file for testing):

- `GOOGLE_API_KEY`: Your Google API key for accessing the Gemini API.

### Local Development

1. Install Deno: https://deno.land/#installation
2. Create a `.env` file in the project root and add your `GOOGLE_API_KEY`:

   ```
   GOOGLE_API_KEY=AIzaSyYOUR_ACTUAL_API_KEY
   ```
3. Run the server:

   ```bash
   deno run --allow-net --allow-env main.ts
   ```

   The server will typically start on `http://localhost:8000`.

### Deployment (Deno Deploy)

1. Create a new project on Deno Deploy.
2. Link your GitHub repository containing this project.
3. In the Deno Deploy project settings, add an environment variable:
   - `Name`: `GOOGLE_API_KEY`
   - `Value`: Your actual Google API key.
4. Deno Deploy will automatically build and deploy your `main.ts` file. You will get a public URL (e.g., `https://your-project-name.deno.dev`).

## Usage

Your client applications (e.g., Python scripts using the `google-genai` SDK) should be configured to send their Gemini API requests to this forwarder's URL instead of the default Google API endpoint.

For the `google-genai` Python SDK, this is typically done by setting the `api_endpoint` in `client_options` when creating the `genai.Client`:

```python
import google.genai as genai
import os

DENO_FORWARDER_BASE_URL = "https://your-project-name.deno.dev" # Replace with your Deno Deploy URL
# The path after the base URL should match what the Gemini SDK expects,
# and your Deno forwarder should strip any custom prefix if needed.
# The google-genai SDK will append paths like /v1beta/models/gemini-2.0-flash:generateContent
# So, the api_endpoint should be the base part that the SDK will append to.
# If your Deno forwarder handles requests at its root that correspond to the SDK's expected paths,
# then DENO_FORWARDER_BASE_URL is correct.
# If your Deno forwarder has a prefix like /forward, adjust accordingly.

client_options = {"api_endpoint": DENO_FORWARDER_BASE_URL}
api_key_for_client = os.environ.get("GOOGLE_API_KEY") # Or a dummy key if Deno handles auth

client = genai.Client(api_key=api_key_for_client, client_options=client_options)

# Example call:
# response = client.models.generate_content(
#     model="models/gemini-2.0-flash", # SDK might prepend "models/" or expect it
#     contents=["Hello from client!"]
# )
# print(response.text)
```
