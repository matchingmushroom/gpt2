const http = require("http");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "client", "out");
const publicDir = path.join(__dirname, "client", "public");
const port = 3000;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function writeOK(res, data, ext) {
  res.writeHead(200, { ...CORS_HEADERS, "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(data);
}

function tryFile(res, filePath) {
  return new Promise((resolve) => {
    fs.readFile(filePath, (err, data) => {
      if (err) return resolve(false);
      const ext = path.extname(filePath);
      writeOK(res, data, ext);
      resolve(true);
    });
  });
}

http
  .createServer(async (req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);

    // Serve / as /index.html
    if (url === "/") {
      const data = fs.readFileSync(path.join(dir, "index.html"));
      res.writeHead(200, { ...CORS_HEADERS, "Content-Type": "text/html" });
      return res.end(data);
    }

    // Try exact file
    if (await tryFile(res, path.join(dir, url))) return;

    // Try with /index.html (for trailing-slash directories)
    if (await tryFile(res, path.join(dir, url, "index.html"))) return;

    // Try with .html extension (for clean URLs)
    if (await tryFile(res, path.join(dir, url + ".html"))) return;

    // Try with trailing slash + index.html
    if (await tryFile(res, path.join(dir, url + "/index.html"))) return;

    // Try from public/ (for images placed without rebuild)
    if (await tryFile(res, path.join(publicDir, url))) return;

    res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "text/html" });
    res.end("404 Not Found");
  })
  .listen(port, () => {
    console.log(`Serving at http://localhost:${port}`);
  });
