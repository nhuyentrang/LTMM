// server.js
const fs = require("fs");
const https = require("https");
const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = https.createServer({
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
}, app);

const wss = new WebSocket.Server({ server });

let clients = new Map();

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "register") {
        clients.set(ws, { username: data.username, publicKey: data.publicKey });
        // Gửi danh sách public key cho client khác
        for (let client of wss.clients) {
          if (client !== ws && clients.has(client)) {
            client.send(JSON.stringify({
              type: "publicKey",
              username: data.username,
              publicKey: data.publicKey
            }));
            ws.send(JSON.stringify({
              type: "publicKey",
              username: clients.get(client).username,
              publicKey: clients.get(client).publicKey
            }));
          }
        }
      } else if (data.type === "message") {
        // Gửi tin nhắn đã mã hóa cho tất cả client khác
        for (let client of wss.clients) {
          if (client !== ws && clients.has(client)) {
            client.send(JSON.stringify({
              type: "message",
              from: clients.get(ws).username,
              ciphertext: data.ciphertext
            }));
          }
        }
      }
    } catch (e) {
      console.error("Invalid message:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected");
  });
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = 8443;
server.listen(PORT, () => {
  console.log(`Secure Chat Server running at https://localhost:${PORT}`);
});
