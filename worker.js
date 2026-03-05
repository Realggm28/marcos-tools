export default {
  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();

      // Detect PDF document blocks to enable the required beta header
      const hasPdfDocument = Array.isArray(body?.messages) && body.messages.some(m => {
        const c = m?.content;
        if (!c) return false;
        if (Array.isArray(c)) {
          return c.some(part => part?.type === "document" && part?.source?.media_type === "application/pdf");
        }
        return false;
      });

      const headers = {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      };

      if (hasPdfDocument) {
        headers["anthropic-beta"] = "pdfs-2024-09-25";
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // If error, return the real error body so the browser can show what went wrong
      if (!response.ok) {
        const errText = await response.text();
        return new Response(errText, {
          status: response.status,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Stream the response back
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }
};
