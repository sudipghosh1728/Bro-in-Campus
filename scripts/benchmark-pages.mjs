import { performance } from "node:perf_hooks";

const base = process.argv[2] || "http://127.0.0.1:3001";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("This smoke benchmark is limited to a local preview.");
const routes = ["/", "/community", "/learn", "/colleges", "/api/questions?sort=recommended&take=20"];
for (const path of routes) {
  const samples = [];
  let bytes = 0;
  for (let i = 0; i < 4; i++) {
    const started = performance.now();
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000) });
    const body = await response.text();
    if (!response.ok || body.includes("Connect the platform to")) throw new Error(`Route failed: ${path} (${response.status})`);
    bytes = Buffer.byteLength(body);
    if (i) samples.push(Math.round(performance.now() - started)); // omit cold pool warm-up
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({ route: path, medianMs: samples[1], samplesMs: samples, responseKB: Math.round(bytes / 1024) }));
}
