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

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY secret in Cloudflare Worker settings" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    try {
      const body = await request.json();

      // Convert Anthropic-style request body to OpenAI format
      const messages = [];

      if (body.system) {
        messages.push({ role: "system", content: body.system });
      }

      for (const msg of body.messages) {
        if (typeof msg.content === "string") {
          messages.push({ role: msg.role, content: msg.content });
        } else {
          const parts = [];
          for (const part of msg.content) {
            if (part.type === "text") {
              parts.push({ type: "text", text: part.text });
            } else if (part.type === "image") {
              parts.push({
                type: "image_url",
                image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` }
              });
            } else if (part.type === "document") {
              parts.push({ type: "text", text: "[A PDF was attached but PDF reading requires a different API. Please describe what you need help with from it.]" });
            }
          }
          messages.push({ role: msg.role, content: parts });
        }
      }

      const openaiBody = {
        model: "gpt-4o",
        max_tokens: body.max_tokens || 1000,
        stream: true,
        messages,
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(openaiBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(errText, {
          status: response.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // OpenAI streams as SSE — pipe it straight through
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }
};
