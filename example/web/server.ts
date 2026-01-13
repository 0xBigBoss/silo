export {};

const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? "unknown";

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", host });
    }

    if (url.pathname === "/") {
      const apiUrl = process.env.API_URL ?? "unknown";
      return new Response(
        `
        <html>
          <body>
            <h1>silo Example</h1>
            <p>Host: ${host}</p>
            <p>Instance: ${process.env.WORKSPACE_NAME}</p>
            <p>Ports: WEB=${process.env.WEB_PORT}, API=${process.env.API_PORT}</p>
            <p>API URL: ${apiUrl}</p>
          </body>
        </html>
      `,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running on port ${server.port}`);
