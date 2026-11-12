// Zero-dependency server: hardened static files, server-rendered SEO pages and the TestYard REST API.
//
// Environment variables (all optional):
//   PORT               listen port (default 3000)
//   SITE_URL           public origin, e.g. https://testyard.example.com  (used for canonical URLs, sitemap, robots)
//   TRUST_PROXY_HOPS   number of reverse proxies in front of this server (Render/Fly/Railway = 1). Default 0 = ignore X-Forwarded-For.
//   CORS_ORIGIN        comma-separated browser origins allowed to call the API (default "*": the API is public and cookie-less)
//   API_ORIGIN         extra origin the UI may call when the API lives on another host (adds it to the CSP connect-src)
//   GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION   webmaster-tool verification tokens
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { handle } from "./api/core.js";
import { renderHome, renderPage, renderNotFound, sitemapXml, robotsTxt, pageExists } from "./seo.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const PORT = Number(process.env.PORT) || 3000;
const HOPS = Math.max(0, Number(process.env.TRUST_PROXY_HOPS) || 0);

let SITE_ORIGIN = "";
if (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL) {
  try { SITE_ORIGIN = new URL(process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL).origin; }
  catch { console.error("SITE_URL is not a valid URL"); process.exit(1); }
}
let API_ORIGIN = "";
if (process.env.API_ORIGIN) {
  try { API_ORIGIN = new URL(process.env.API_ORIGIN).origin; } catch { console.error("API_ORIGIN is not a valid URL"); process.exit(1); }
}

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
  `connect-src 'self'${API_ORIGIN ? " " + API_ORIGIN : ""}`, "frame-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");
const SEC = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
const API_EXTRA = { "X-Frame-Options": "DENY", "Strict-Transport-Security": SEC["Strict-Transport-Security"] };

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;
const gzCache = new Map();

function clientIp(req) {
  const sock = req.socket.remoteAddress || "unknown";
  if (!HOPS) return sock; // never trust X-Forwarded-For unless a proxy we control sets it
  const xs = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xs[xs.length - HOPS] || sock; // the entry appended by OUR proxy, not one the client can forge
}
function originOf(req) {
  if (SITE_ORIGIN) return SITE_ORIGIN;
  const host = String(req.headers.host || "localhost");
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return "http://localhost";
  return `${HOPS > 0 && req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}`;
}

function send(req, res, status, headers, body, cacheKey) {
  const h = { ...SEC, ...headers };
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const wantsGzip = buf.length > 1024 && COMPRESSIBLE.test(h["Content-Type"] || "") && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  let out = buf;
  if (wantsGzip) {
    out = cacheKey && gzCache.get(cacheKey);
    if (!out) { out = zlib.gzipSync(buf); if (cacheKey) { if (gzCache.size > 300) gzCache.clear(); gzCache.set(cacheKey, out); } }
    h["Content-Encoding"] = "gzip";
    h.Vary = "Accept-Encoding";
  }
  h["Content-Length"] = out.length;
  res.writeHead(status, h);
  res.end(req.method === "HEAD" ? undefined : out);
}
const html = (req, res, status, body) => send(req, res, status, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" }, body);
const redirect = (req, res, to) => send(req, res, 301, { Location: to, "Content-Type": MIME[".txt"] }, "");

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
    req.on("error", reject);
  });
}

async function api(req, res, url) {
  const isUpload = url.pathname === "/api/upload";
  const limit = isUpload ? 4 * 1024 * 1024 : 101 * 1024;
  const json = (status, msg) => { res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", Connection: "close" }); res.end(JSON.stringify({ success: false, status, message: msg })); };
  let raw = "";
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (Number(req.headers["content-length"]) > limit) return json(413, "Request body too large");
    try { raw = await readBody(req, limit); } catch { return json(413, "Request body too large"); }
    // JSON bodies are UTF-8; multipart stays latin1 so byte sizes are exact.
    if (!/multipart/i.test(req.headers["content-type"] || "")) raw = Buffer.from(raw, "latin1").toString("utf8");
  }
  const out = await handle({ method: req.method, url: req.url, headers: req.headers, rawBody: raw, ip: clientIp(req) });
  res.writeHead(out.status, { ...API_EXTRA, ...out.headers });
  res.end(req.method === "HEAD" ? undefined : out.body);
}

const server = http.createServer(async (req, res) => {
  try {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); res.end("Bad request"); return; }
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") return await api(req, res, url);

    if (req.method !== "GET" && req.method !== "HEAD") { send(req, res, 405, { Allow: "GET, HEAD", "Content-Type": MIME[".txt"] }, "Method not allowed"); return; }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { send(req, res, 400, { "Content-Type": MIME[".txt"] }, "Bad request"); return; }
    if (pathname.includes("\0")) { send(req, res, 400, { "Content-Type": MIME[".txt"] }, "Bad request"); return; }
    const origin = originOf(req);

    if (pathname === "/") return html(req, res, 200, renderHome(origin));
    if (pathname === "/index.html") return redirect(req, res, "/");
    if (pathname === "/robots.txt") return send(req, res, 200, { "Content-Type": MIME[".txt"], "Cache-Control": "public, max-age=3600" }, robotsTxt(origin));
    if (pathname === "/sitemap.xml") return send(req, res, 200, { "Content-Type": MIME[".xml"], "Cache-Control": "public, max-age=3600" }, sitemapXml(origin));
    if (pathname === "/practice" || pathname === "/practice/") return redirect(req, res, "/");
    if (pathname.startsWith("/practice/")) {
      const id = pathname.slice("/practice/".length);
      if (id.endsWith("/")) return redirect(req, res, "/practice/" + id.replace(/\/+$/, ""));
      return pageExists(id) ? html(req, res, 200, renderPage(id, origin)) : html(req, res, 404, renderNotFound(origin));
    }

    // Static files: no dotfiles, no traversal, only inside /public.
    const file = path.normalize(path.join(ROOT, pathname));
    const segments = path.relative(ROOT, file).split(path.sep);
    if (!file.startsWith(ROOT + path.sep) || segments.some((s) => s.startsWith(".") || s === "..")) return html(req, res, 404, renderNotFound(origin));
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return html(req, res, 404, renderNotFound(origin));
      fs.readFile(file, (e2, data) => {
        if (e2) return html(req, res, 404, renderNotFound(origin));
        const ext = path.extname(file).toLowerCase();
        send(req, res, 200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "public, max-age=300" }, data, file + st.mtimeMs);
      });
    });
  } catch (e) {
    console.error("server error", e);
    if (!res.headersSent) { res.writeHead(500, { "Content-Type": "text/plain" }); res.end("Server error"); } else res.end();
  }
});

server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
server.listen(PORT, "0.0.0.0", () => console.log(`TestYard running on http://localhost:${PORT}`));
