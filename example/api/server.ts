export {};

const server = Bun.serve({
  port: 8080,
  fetch(req) {
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? "unknown";

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "api", host });
    }

    if (url.pathname === "/") {
      return Response.json({
        service: "api",
        host,
        instance: process.env.WORKSPACE_NAME,
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`API server running on port ${server.port}`);
