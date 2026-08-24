// Extract the assistant's final result text from a `claude -p --output-format
// json` run. That flag may emit a single {result} object OR an array of stream
// events whose final `type:"result"` element carries the text; handle both, then
// fall back to concatenated assistant text, then the raw input. Reads a file
// path argument, or stdin when none is given.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function extractResultText(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (Array.isArray(value)) {
    const result = value.find((event) => event && event.type === "result" && typeof event.result === "string");
    if (result) return result.result;
    const parts = [];
    for (const event of value) {
      const content = event?.message?.content;
      if (Array.isArray(content)) for (const block of content) if (block?.type === "text") parts.push(block.text);
    }
    return parts.join("\n") || raw;
  }
  return value.result ?? value.text ?? raw;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  const raw = path ? fs.readFileSync(path, "utf8") : fs.readFileSync(0, "utf8");
  process.stdout.write(extractResultText(raw));
}
