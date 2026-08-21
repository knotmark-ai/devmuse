import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const BLOCK_SIZE = 512;
const ZERO_BLOCKS = Buffer.alloc(BLOCK_SIZE * 2);
const MAX_COMPRESSED_SIZE = 64 * 1024 * 1024;
const MAX_EXPANDED_SIZE = 256 * 1024 * 1024;
const MAX_ENTRY_SIZE = 64 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

const utf8Sort = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function assertSafeArchivePath(entryPath) {
  if (
    typeof entryPath !== "string"
    || entryPath.length === 0
    || entryPath.includes("\0")
    || entryPath.includes("\\")
    || entryPath.startsWith("/")
    || /^[A-Za-z]:\//.test(entryPath)
    || entryPath.endsWith("/")
  ) throw new Error(`Unsafe archive path: ${entryPath}`);
  const segments = entryPath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Unsafe archive path: ${entryPath}`);
  }
  if (segments[0] !== "devmuse" || segments.length < 2) {
    throw new Error(`Unsafe archive path outside devmuse root: ${entryPath}`);
  }
}

function writeString(target, offset, length, value) {
  const body = Buffer.from(value, "utf8");
  if (body.length > length) throw new Error(`Tar field is too long: ${value}`);
  body.copy(target, offset);
}

function writeOctal(target, offset, length, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid tar numeric value: ${value}`);
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) throw new Error(`Tar numeric value does not fit: ${value}`);
  writeString(target, offset, length, `${encoded}\0`);
}

function splitUstarPath(entryPath) {
  if (Buffer.byteLength(entryPath) <= 100) return { name: entryPath, prefix: "" };
  const slashes = [...entryPath.matchAll(/\//g)].map((match) => match.index).reverse();
  for (const slash of slashes) {
    const prefix = entryPath.slice(0, slash);
    const name = entryPath.slice(slash + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  return null;
}

function makeHeader({ entryPath, mode, size, mtime, type = "0", fallbackName }) {
  const split = splitUstarPath(entryPath) ?? { name: fallbackName, prefix: "" };
  const header = Buffer.alloc(BLOCK_SIZE);
  writeString(header, 0, 100, split.name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtime);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeString(header, 345, 155, split.prefix);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

function padBody(body) {
  const remainder = body.length % BLOCK_SIZE;
  return remainder === 0 ? body : Buffer.concat([body, Buffer.alloc(BLOCK_SIZE - remainder)]);
}

function paxRecord(key, value) {
  const suffix = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(suffix) + 1;
  for (;;) {
    const record = `${length}${suffix}`;
    const actual = Buffer.byteLength(record);
    if (actual === length) return Buffer.from(record);
    length = actual;
  }
}

function archiveParts(entry, index, sourceEpoch) {
  const split = splitUstarPath(entry.path);
  const parts = [];
  if (!split) {
    const paxBody = paxRecord("path", entry.path);
    const paxName = `PaxHeaders/${String(index).padStart(6, "0")}`;
    parts.push(
      makeHeader({
        entryPath: paxName,
        fallbackName: paxName,
        mode: 0o644,
        size: paxBody.length,
        mtime: sourceEpoch,
        type: "x",
      }),
      padBody(paxBody),
    );
  }
  parts.push(
    makeHeader({
      entryPath: entry.path,
      fallbackName: `PaxFiles/${String(index).padStart(6, "0")}`,
      mode: entry.mode,
      size: entry.body.length,
      mtime: sourceEpoch,
    }),
    padBody(entry.body),
  );
  return parts;
}

export function createTarGz(entries, options) {
  const sourceEpoch = options?.sourceEpoch;
  if (!Number.isSafeInteger(sourceEpoch) || sourceEpoch < 0) {
    throw new Error(`Invalid source epoch: ${sourceEpoch}`);
  }
  const normalized = entries.map((entry) => {
    assertSafeArchivePath(entry.path);
    if (entry.mode !== 0o644 && entry.mode !== 0o755) {
      throw new Error(`Unsupported archive mode for ${entry.path}: ${entry.mode}`);
    }
    return { path: entry.path, mode: entry.mode, body: Buffer.from(entry.body) };
  }).sort((left, right) => utf8Sort(left.path, right.path));

  if (!options?.allowDuplicateFixture) {
    const paths = normalized.map((entry) => entry.path);
    if (new Set(paths).size !== paths.length) throw new Error("Duplicate archive path");
  }

  const tar = Buffer.concat([
    ...normalized.flatMap((entry, index) => archiveParts(entry, index, sourceEpoch)),
    ZERO_BLOCKS,
  ]);
  const gzip = Buffer.from(gzipSync(tar, { level: 9, mtime: 0 }));
  gzip.fill(0, 4, 8);
  gzip[9] = 255;
  return gzip;
}

function readString(block, offset, length) {
  const field = block.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
}

function readOctal(block, offset, length) {
  const value = readString(block, offset, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new Error(`Invalid tar octal field: ${JSON.stringify(value)}`);
  return Number.parseInt(value, 8);
}

function verifyHeaderChecksum(block) {
  const expected = readOctal(block, 148, 8);
  const copy = Buffer.from(block);
  copy.fill(0x20, 148, 156);
  const actual = copy.reduce((total, byte) => total + byte, 0);
  if (actual !== expected) throw new Error(`Tar header checksum mismatch: expected ${expected}, got ${actual}`);
}

function parsePax(body) {
  const values = {};
  let offset = 0;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    if (space < 0) throw new Error("Malformed PAX record length");
    const length = Number(body.subarray(offset, space).toString("ascii"));
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > body.length) {
      throw new Error("Malformed PAX record size");
    }
    const record = body.subarray(space + 1, offset + length).toString("utf8");
    if (!record.endsWith("\n")) throw new Error("Malformed PAX record terminator");
    const separator = record.indexOf("=");
    if (separator < 1) throw new Error("Malformed PAX record value");
    const key = record.slice(0, separator);
    if (key !== "path" || Object.hasOwn(values, key)) throw new Error(`Unsupported or duplicate PAX field: ${key}`);
    values[key] = record.slice(separator + 1, -1);
    offset += length;
  }
  return values;
}

export function readTarGz(input) {
  if (!Buffer.isBuffer(input) || input.length > MAX_COMPRESSED_SIZE) {
    throw new Error("Compressed archive exceeds the supported size");
  }
  if (
    input.length < 18
    || input[0] !== 0x1f
    || input[1] !== 0x8b
    || input[2] !== 8
    || input[3] !== 0
    || !input.subarray(4, 8).every((byte) => byte === 0)
    || input[8] !== 2
    || input[9] !== 255
  ) throw new Error("Archive gzip header is not canonical");
  const tar = gunzipSync(input, { maxOutputLength: MAX_EXPANDED_SIZE });
  if (tar.length < ZERO_BLOCKS.length || tar.length % BLOCK_SIZE !== 0) {
    throw new Error("Tar archive size or terminator is invalid");
  }
  const entries = [];
  const seen = new Set();
  let offset = 0;
  let pax = null;
  let terminated = false;
  while (offset + BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    if (header.every((byte) => byte === 0)) {
      const remainder = tar.subarray(offset);
      if (remainder.length !== ZERO_BLOCKS.length || !remainder.every((byte) => byte === 0)) {
        throw new Error("Tar archive has invalid terminators or trailing data");
      }
      terminated = true;
      offset = tar.length;
      break;
    }
    verifyHeaderChecksum(header);
    if (readString(header, 257, 6) !== "ustar" || readString(header, 263, 2) !== "00") {
      throw new Error("Tar archive is not canonical ustar");
    }
    if (readOctal(header, 108, 8) !== 0 || readOctal(header, 116, 8) !== 0) {
      throw new Error("Tar ownership must be numeric zero");
    }
    for (const [start, end, label] of [[157, 257, "link"], [265, 329, "owner name"], [329, 345, "group name"], [500, 512, "device"]]) {
      if (!header.subarray(start, end).every((byte) => byte === 0)) {
        throw new Error(`Tar ${label} metadata must be empty`);
      }
    }
    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const headerPath = prefix ? `${prefix}/${name}` : name;
    const type = readString(header, 156, 1) || "0";
    const size = readOctal(header, 124, 12);
    if (size > MAX_ENTRY_SIZE) throw new Error(`Tar entry exceeds the supported size: ${headerPath}`);
    const mtime = readOctal(header, 136, 12);
    const mode = readOctal(header, 100, 8) & 0o777;
    const bodyStart = offset + BLOCK_SIZE;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tar.length) throw new Error(`Truncated tar entry: ${headerPath}`);
    const body = Buffer.from(tar.subarray(bodyStart, bodyEnd));
    offset = bodyStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

    if (type === "x") {
      if (pax) throw new Error("Consecutive PAX records are unsupported");
      pax = parsePax(body);
      continue;
    }
    if (type !== "0") throw new Error(`Unsupported archive link or entry type ${type}: ${headerPath}`);
    const entryPath = pax?.path ?? headerPath;
    pax = null;
    assertSafeArchivePath(entryPath);
    if (seen.has(entryPath)) throw new Error(`Duplicate archive path: ${entryPath}`);
    seen.add(entryPath);
    if (mode !== 0o644 && mode !== 0o755) throw new Error(`Unsupported archive mode: ${entryPath}`);
    entries.push({ path: entryPath, mode, mtime, body });
    if (entries.length > MAX_ENTRIES) throw new Error("Archive contains too many entries");
  }
  if (!terminated) throw new Error("Tar archive has no exact end marker");
  if (pax) throw new Error("PAX record has no following file");
  return entries;
}

export function extractTarGz(input, destination) {
  const entries = readTarGz(input);
  const root = path.resolve(destination);
  const targets = entries.map((entry) => {
    const target = path.resolve(root, ...entry.path.split("/"));
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Archive entry escapes extraction root: ${entry.path}`);
    }
    return { ...entry, target };
  });
  for (const entry of targets) {
    fs.mkdirSync(path.dirname(entry.target), { recursive: true });
    fs.writeFileSync(entry.target, entry.body, { mode: entry.mode, flag: "wx" });
    fs.chmodSync(entry.target, entry.mode);
  }
  return targets.map((entry) => entry.target);
}
