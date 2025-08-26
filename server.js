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
  // Assign roles based on connection order
  if (!broadcasterSocket) {
    broadcasterSocket = ws;
    ws.role = "broadcaster";
    console.log("Broadcaster connected.");
  } else if (!viewerSocket) {
    viewerSocket = ws;
    ws.role = "viewer";
    console.log("Viewer connected.");
  } else {
    // If a third client tries to connect, reject it.
    console.log("Connection rejected: Server is full.");
    ws.close(1013, "Server is full. Please try again later.");
    return;
  }

  // Handle incoming messages by simply relaying them to the other party.
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());
    console.log(`Received message of type '${data.type}' from ${ws.role}`);

    // Forward message to the other connected client
    if (ws.role === "broadcaster") {
      if (viewerSocket) {
        console.log("Forwarding message from broadcaster to viewer.");
        viewerSocket.send(message.toString());
      } else {
        console.log("Broadcaster sent a message, but no viewer is connected.");
      }
    } else if (ws.role === "viewer") {
      if (broadcasterSocket) {
        console.log("Forwarding message from viewer to broadcaster.");
        broadcasterSocket.send(message.toString());
      } else {
        console.log("Viewer sent a message, but no broadcaster is connected.");
      }
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
