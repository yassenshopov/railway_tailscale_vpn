const http = require("http");
const net = require("net");

console.log("🔀 Starting ECU Proxy Server...");

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/proxy") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const { target, opcode, payload } = JSON.parse(body);
        const [host, port] = target.split(":");

        console.log(`🔀 [Tailscale Proxy] Forwarding ${opcode} to ${host}:${port}`);

        // Create TCP connection to target through Tailscale
        const client = net.createConnection(
          {
            host,
            port: parseInt(port),
            timeout: 10000,
          },
          () => {
            console.log(`✅ [Tailscale Proxy] Connected to ${target}`);

            // Send ECU message with length prefix (like your gateway expects)
            const message = JSON.stringify({ opcode, payload });
            const messageBuffer = Buffer.from(message, "utf8");
            const lengthBuffer = Buffer.alloc(4);
            lengthBuffer.writeUInt32BE(messageBuffer.length, 0);
            const fullMessage = Buffer.concat([lengthBuffer, messageBuffer]);

            console.log(`📤 [Tailscale Proxy] Sending: ${message}`);
            client.write(fullMessage);
          }
        );

        let responseData = Buffer.alloc(0);

        client.on("data", (data) => {
          responseData = Buffer.concat([responseData, data]);
          console.log(`📥 [Tailscale Proxy] Received ${data.length} bytes`);

          // Check if we have a complete response (length prefix + data)
          if (responseData.length >= 4) {
            const messageLength = responseData.readUInt32BE(0);
            if (responseData.length >= 4 + messageLength) {
              const messageData = responseData.slice(4, 4 + messageLength);
              const responseStr = messageData.toString("utf8");

              console.log(`✅ [Tailscale Proxy] Complete response: ${responseStr}`);

              try {
                const responseObj = JSON.parse(responseStr);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    ok: true,
                    data: responseObj,
                    opcode,
                    target,
                  })
                );
              } catch (parseError) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    ok: true,
                    data: responseStr,
                    opcode,
                    target,
                  })
                );
              }

              client.end();
            }
          }
        });

        client.on("error", (error) => {
          console.error(`❌ [Tailscale Proxy] Connection error:`, error.message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: false,
              error: error.message,
              target,
              opcode,
            })
          );
        });

        client.on("timeout", () => {
          console.error(`⏰ [Tailscale Proxy] Connection timeout to ${target}`);
          client.destroy();
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: false,
              error: "Connection timeout after 10 seconds",
              target,
              opcode,
            })
          );
        });
      } catch (error) {
        console.error(`❌ [Tailscale Proxy] Parse error:`, error.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            error: "Invalid request format",
            details: error.message,
          })
        );
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        service: "ECU Tailscale Proxy",
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

const PORT = 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🔀 ECU Proxy listening on port ${PORT}`);
  console.log(`📡 Proxy endpoint: http://localhost:${PORT}/proxy`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ ECU Proxy server closed");
    process.exit(0);
  });
});
