// server.js
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

// This server assumes a simple one-to-one connection:
// The first client to connect is the broadcaster.
// The second client to connect is the viewer.
let broadcasterSocket = null;
let viewerSocket = null;

const wss = new WebSocketServer({ noServer: true });

console.log("Signaling server starting...");

wss.on("connection", (ws) => {
  ws.role = null;

  // Handle incoming messages by simply relaying them to the other party.
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());
    
    // Handle role assignment
    if (!ws.role && data.type === "role") {
      if (data.role === "broadcaster") {
        if (broadcasterSocket) {
          ws.close(1013, "Broadcaster already connected.");
          return;
        }
        ws.role = "broadcaster";
        broadcasterSocket = ws;
        console.log("Broadcaster connected.");
      } else if (data.role === "viewer") {
        if (viewerSocket) {
          ws.close(1013, "Viewer already connected.");
          return;
        }
        ws.role = "viewer";
        viewerSocket = ws;
        console.log("Viewer connected.");
      } else {
        ws.close(1008, "Unknown role.");
        return;
      }
      return;
    }

    console.log(`Received message of type '${data.type}' from ${ws.role}`);

    // Relay signaling messages
    if (ws.role === "broadcaster" && viewerSocket) {
      viewerSocket.send(message.toString());
    } else if (ws.role === "viewer" && broadcasterSocket) {
      broadcasterSocket.send(message.toString());
    }
  });

  // Handle client disconnections
  ws.on("close", () => {
    console.log(`${ws.role} disconnected.`);
    if (ws.role === "broadcaster") {
      broadcasterSocket = null;
      // Optionally, disconnect the viewer as well since the stream is gone.
      if (viewerSocket) {
        viewerSocket.close(1000, "Broadcaster disconnected.");
        viewerSocket = null;
      }
    } else if (ws.role === "viewer") {
      viewerSocket = null;
    }
  });

  ws.on("error", (error) => {
    console.error(`Error on ${ws.role} socket:`, error);
  });
});

const server = app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));

// Handle the HTTP upgrade request to a WebSocket connection
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
