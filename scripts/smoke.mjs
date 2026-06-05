import { spawn } from "node:child_process";

const port = 4183;
const server = spawn(process.execPath, ["scripts/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw lastError;
}

try {
  const html = await (await fetchWithRetry(`http://127.0.0.1:${port}/`)).text();
  const app = await fetchWithRetry(`http://127.0.0.1:${port}/src/app.js`);
  const asset = await fetchWithRetry(`http://127.0.0.1:${port}/src/assets/town-scene.svg`);

  if (!html.includes("AI 小镇生活") || !html.includes("./src/app.js")) {
    throw new Error("index.html content check failed.");
  }

  console.log(
    JSON.stringify(
      {
        index: "ok",
        app: app.status,
        asset: asset.status,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
  await wait(100);
}

server.on("exit", (code) => {
  if (code && code !== 0 && code !== null) {
    console.error(output);
  }
});
