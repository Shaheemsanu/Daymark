// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var PORT = envPort === 8080 ? 3e3 : envPort || 3e3;
var DIST_DIR = path.resolve(__dirname, "dist");
app.use(express.static(DIST_DIR, {
  maxAge: "1y",
  index: false
}));
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Daymark production server listening on http://0.0.0.0:${PORT}`);
});
