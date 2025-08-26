// server.js
import express from "express"
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

let broadcaster = null;
let viewer = null;

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case "broadcaster":
        broadcaster = ws;
        ws.isBroadcaster = true;
        console.log("Broadcaster connected");
        break;

      case "offer":
        viewer = ws;
        viewer.send(JSON.stringify({ type: "ack" }));
        if (broadcaster) {
          broadcaster.send(JSON.stringify({ type: "offer", sdp: data.sdp }));
        }
        break;

      case "answer":
        if (viewer) {
          viewer.send(JSON.stringify({ type: "answer", sdp: data.sdp }));
        }
        break;

      case "ice-candidate":
        const target = data.target === "broadcaster" ? broadcaster : viewer;
        if (target) {
          target.send(JSON.stringify({ type: "ice-candidate", candidate: data.candidate }));
        }
        break;
    }
  });

  ws.on("close", () => {
    if (ws.isBroadcaster) {
      console.log("Broadcaster disconnected");
      broadcaster = null;
    } else {
      console.log("Viewer disconnected");
      viewer = null;
    }
  });
});

const server = app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
