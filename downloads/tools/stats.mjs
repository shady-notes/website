// `make downloads-stats`: DMG downloads per day as a plain table.
// Wrangler prints nothing at all for an empty result, which reads like a
// failure, so this always prints either a table with totals or a clear "none".
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SQL = `SELECT day,
  SUM(CASE WHEN kind='site' THEN n ELSE 0 END) AS site,
  SUM(CASE WHEN kind='update' THEN n ELSE 0 END) AS updates,
  SUM(CASE WHEN kind='homebrew' THEN n ELSE 0 END) AS homebrew,
  SUM(CASE WHEN kind='other' THEN n ELSE 0 END) AS other
FROM downloads GROUP BY day ORDER BY day DESC LIMIT 60`;

const out = execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "downloads", "--remote", "--json", "--command", SQL],
  { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const rows = JSON.parse(out)[0].results;

console.log("");
if (rows.length === 0) {
  console.log("No downloads counted yet (counting started 2026-11-11).");
  process.exit(0);
}

const cols = ["day", "site", "updates", "homebrew", "other"];
const total = { day: "total" };
for (const c of cols.slice(1)) total[c] = rows.reduce((s, r) => s + r[c], 0);
const all = [...rows, total];
const w = cols.map((c) => Math.max(c.length, ...all.map((r) => String(r[c]).length)));
const line = (r) => cols.map((c, i) => (i === 0 ? String(r[c]).padEnd(w[i]) : String(r[c]).padStart(w[i]))).join("   ");

console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
console.log(w.map((n) => "─".repeat(n)).join("   "));
rows.forEach((r) => console.log(line(r)));
console.log(w.map((n) => "─".repeat(n)).join("   "));
console.log(line(total));
console.log("\nsite = browser downloads (the campaign number) · updates = Sparkle · other = curl/scripts");
