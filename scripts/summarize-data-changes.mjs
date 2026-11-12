// Prints a Markdown summary of how data/countries.json differs from the
// committed copy (git HEAD): which countries changed and which fields.
// Used for the body of the data-refresh pull request.
//
//   node scripts/summarize-data-changes.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const before = JSON.parse(execFileSync("git", ["show", "HEAD:data/countries.json"], { maxBuffer: 64 * 1024 * 1024 }).toString());
const after = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
const byCode = (list) => new Map(list.map((c) => [c.alpha3Code, c]));
const was = byCode(before);
const now = byCode(after);

const lines = [];
for (const [code, c] of now) {
  const old = was.get(code);
  if (!old) {
    lines.push(`- **${c.name}**: added`);
    continue;
  }
  const fields = [...new Set([...Object.keys(old), ...Object.keys(c)])].filter((k) => JSON.stringify(old[k]) !== JSON.stringify(c[k]));
  if (fields.length) lines.push(`- **${c.name}**: ${fields.join(", ")}`);
}
for (const [code, c] of was) if (!now.has(code)) lines.push(`- **${c.name}**: removed`);

console.log(`${lines.length} of ${now.size} countries changed.\n`);
console.log(lines.slice(0, 200).join("\n"));
if (lines.length > 200) console.log(`\n…and ${lines.length - 200} more.`);
