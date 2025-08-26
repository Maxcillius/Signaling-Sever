// server.js
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

let broadcasterSocket = null;
let viewerSocket = null;

const wss = new WebSocketServer({ noServer: true });

console.log("Signaling server starting...");

wss.on("connection", (ws) => {
  ws.role = null; // Role is unknown until the client identifies itself

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());

    // --- Role Identification ---
    // The first message from a client MUST be to identify its role.
    if (data.type === "identify") {
      if (data.role === "broadcaster") {
        if (broadcasterSocket) {
          console.log("Rejecting connection: Broadcaster already connected.");
          ws.close(1013, "Broadcaster already connected.");
          return;
        }
        ws.role = "broadcaster";
        broadcasterSocket = ws;
        console.log("Broadcaster identified and connected.");
      } else if (data.role === "viewer") {
        if (viewerSocket) {
          console.log("Rejecting connection: Viewer already connected.");
          ws.close(1013, "Viewer already connected.");
          return;
        }
        ws.role = "viewer";
        viewerSocket = ws;
        console.log("Viewer identified and connected.");
      } else {
        ws.close(1008, "Invalid role specified.");
      }
      return; // Stop processing this message further
    }

    // --- Message Relaying ---
    // If the role is known, relay the message to the other party.
    console.log(`Received message of type '${data.type}' from ${ws.role}`);
    if (ws.role === "broadcaster" && viewerSocket) {
      viewerSocket.send(message.toString());
    } else if (ws.role === "viewer" && broadcasterSocket) {
      broadcasterSocket.send(message.toString());
    }
  });

  ws.on("close", () => {
    if (ws.role) { // Only log if a role was assigned
        console.log(`${ws.role} disconnected.`);
    }
    if (ws.role === "broadcaster") {
      broadcasterSocket = null;
      if (viewerSocket) {
        viewerSocket.close(1000, "Broadcaster disconnected.");
        viewerSocket = null;
      }
    } else if (ws.role === "viewer") {
      viewerSocket = null;
    }
  });

  ws.on("error", (error) => {
    console.error(`Error on socket (role: ${ws.role || 'unknown'}):`, error);
  });
});

const server = app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
