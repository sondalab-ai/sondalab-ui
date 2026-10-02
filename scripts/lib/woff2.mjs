import { brotliDecompressSync } from "node:zlib";

// A minimal WOFF2 reader for the font tests: the signature, the table
// directory, and the two tables the tests ask about (cmap, fvar). Neither is
// ever transformed by WOFF2, but the tables before them in the stream may be
// (glyf, loca, hmtx), so every entry's stored length is read to find them.
// https://www.w3.org/TR/WOFF2/ §5 (table directory), §6 (compressed stream).

const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm",
  "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern",
  "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
  "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty",
  "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];

/** The four signature bytes of a WOFF2 file. */
export const WOFF2_MAGIC = "wOF2";

/** Read a WOFF2 buffer into { tables: Map<tag, Buffer> } (untransformed ones). */
export function readWoff2(buf) {
  if (buf.toString("latin1", 0, 4) !== WOFF2_MAGIC) throw new Error("not a WOFF2 file");
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[p++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error("bad UIntBase128");
  };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++];
    let tag;
    if ((flags & 0x3f) === 0x3f) { tag = buf.toString("latin1", p, p + 4); p += 4; } else tag = KNOWN_TAGS[flags & 0x3f];
    const version = flags >> 6;
    const origLength = base128();
    // glyf/loca are transformed at version 0; every other table at 1-3.
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    const stored = transformed ? base128() : origLength;
    dir.push({ tag, stored, transformed });
  }
  const stream = brotliDecompressSync(buf.subarray(p, p + compressedSize));
  const tables = new Map();
  let off = 0;
  for (const t of dir) {
    if (!t.transformed) tables.set(t.tag, stream.subarray(off, off + t.stored));
    off += t.stored;
  }
  return { tables };
}

/** Every code point the font maps (cmap format 12, else format 4). */
export function codepoints({ tables }) {
  const c = tables.get("cmap");
  const n = c.readUInt16BE(2);
  const subs = [];
  for (let i = 0; i < n; i++) {
    const off = c.readUInt32BE(4 + i * 8 + 4);
    subs.push({ platform: c.readUInt16BE(4 + i * 8), encoding: c.readUInt16BE(4 + i * 8 + 2), off, format: c.readUInt16BE(off) });
  }
  const out = new Set();
  const f12 = subs.find((s) => s.format === 12);
  if (f12) {
    const groups = c.readUInt32BE(f12.off + 12);
    for (let g = 0; g < groups; g++) {
      const q = f12.off + 16 + g * 12;
      for (let cp = c.readUInt32BE(q); cp <= c.readUInt32BE(q + 4); cp++) out.add(cp);
    }
    return out;
  }
  const f4 = subs.find((s) => s.format === 4 && s.platform === 3) ?? subs.find((s) => s.format === 4);
  const segX2 = c.readUInt16BE(f4.off + 6);
  const ends = f4.off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  for (let s = 0; s < segX2 / 2; s++) {
    const end = c.readUInt16BE(ends + s * 2), start = c.readUInt16BE(starts + s * 2);
    const delta = c.readInt16BE(deltas + s * 2), rangeOff = c.readUInt16BE(ranges + s * 2);
    for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
      const gid = rangeOff === 0
        ? (cp + delta) & 0xffff
        : c.readUInt16BE(ranges + s * 2 + rangeOff + (cp - start) * 2);
      if (gid !== 0) out.add(cp);
    }
  }
  return out;
}

/** The variation axes: [{ tag, min, def, max }]; empty for a static font. */
export function axes({ tables }) {
  const f = tables.get("fvar");
  if (!f) return [];
  const offset = f.readUInt16BE(4), count = f.readUInt16BE(8), size = f.readUInt16BE(10);
  const fixed = (o) => f.readInt32BE(o) / 65536;
  return Array.from({ length: count }, (_, i) => {
    const o = offset + i * size;
    return { tag: f.toString("latin1", o, o + 4), min: fixed(o + 4), def: fixed(o + 8), max: fixed(o + 12) };
  });
}

/** Parse a CSS unicode-range value ("U+0000-00FF, U+0131, …") into a Set. */
export function parseUnicodeRange(value) {
  const out = new Set();
  for (const part of value.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i);
    if (!m) throw new Error(`bad unicode-range item: ${part}`);
    const a = parseInt(m[1].replace(/\?/g, "0"), 16);
    const b = m[2] ? parseInt(m[2], 16) : m[1].includes("?") ? parseInt(m[1].replace(/\?/g, "F"), 16) : a;
    for (let cp = a; cp <= b; cp++) out.add(cp);
  }
  return out;
}
