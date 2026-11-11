/* A deterministic PNG encoder for the generated art (scripts/gen-art.mjs).
   node:zlib is not used on purpose: its deflate picks matches with
   CPU-specific code, so the same pixels compress to different bytes on a
   Mac and on the CI runner, and the drift check compares bytes. This one is
   plain JavaScript: an indexed-colour PNG, one deflate block with the fixed
   Huffman codes, and a greedy LZ77 match search. It compresses less well
   than zlib and always gives the same output. */

const CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 of `bytes`, as PNG chunks carry it. */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32 of `bytes`, as a zlib stream carries it. */
function adler32(bytes) {
  let a = 1, b = 0;
  for (const v of bytes) { a = (a + v) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

/**
 * `data` as a zlib stream: one final block, fixed Huffman codes, greedy
 * LZ77 over a 32 KiB window. The match search walks a hash chain of the
 * positions that share three bytes, newest first, at most 128 steps.
 * @param {Uint8Array} data @returns {Uint8Array}
 */
export function deflate(data) {
  const out = [0x78, 0x01];
  let acc = 0, bits = 0;
  const raw = (value, n) => { // n bits, least significant first
    acc |= value << bits; bits += n;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  };
  const code = (value, n) => { for (let k = n - 1; k >= 0; k--) raw((value >> k) & 1, 1); }; // a Huffman code, most significant first
  const symbol = (s) => {
    if (s < 144) code(0x30 + s, 8);
    else if (s < 256) code(0x190 + s - 144, 9);
    else if (s < 280) code(s - 256, 7);
    else code(0xc0 + s - 280, 8);
  };
  raw(1, 1); raw(1, 2); // BFINAL, BTYPE = fixed

  const head = new Map(), prev = new Int32Array(data.length).fill(-1);
  const key = (i) => (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  const insert = (i) => { if (i + 2 < data.length) { const k = key(i); prev[i] = head.get(k) ?? -1; head.set(k, i); } };
  for (let i = 0; i < data.length;) {
    let best = 0, dist = 0;
    if (i + 2 < data.length) {
      for (let p = head.get(key(i)) ?? -1, steps = 0; p >= 0 && i - p <= 32768 && steps < 128; p = prev[p], steps++) {
        let n = 0;
        while (n < 258 && i + n < data.length && data[p + n] === data[i + n]) n++;
        if (n > best) { best = n; dist = i - p; if (n === 258) break; }
      }
    }
    if (best >= 3) {
      let l = LEN_BASE.length - 1;
      while (LEN_BASE[l] > best) l--;
      symbol(257 + l); raw(best - LEN_BASE[l], LEN_EXTRA[l]);
      let d = DIST_BASE.length - 1;
      while (DIST_BASE[d] > dist) d--;
      code(d, 5); raw(dist - DIST_BASE[d], DIST_EXTRA[d]);
      for (let k = 0; k < best; k++) insert(i + k);
      i += best;
    } else { symbol(data[i]); insert(i); i++; }
  }
  symbol(256);
  if (bits) out.push(acc & 255);
  const sum = adler32(data);
  out.push(sum >>> 24, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255);
  return Uint8Array.from(out);
}

/**
 * An indexed-colour PNG. `index` holds one palette index per pixel, row by
 * row; `palette` is a list of [r, g, b]. The bit depth is the smallest of
 * 1, 2, 4 and 8 that holds the palette, so 16 colours cost half a byte each.
 * With `clear`, palette entry 0 is fully transparent (a tRNS chunk).
 * @param {Uint8Array} index @param {number[][]} palette
 * @param {number} width @param {number} height @param {boolean} [clear]
 * @returns {Uint8Array}
 */
export function png(index, palette, width, height, clear = false) {
  if (palette.length > 256) throw new Error(`png: ${palette.length} colours do not fit an 8-bit palette`);
  const depth = [1, 2, 4, 8].find((d) => 2 ** d >= palette.length);
  const stride = Math.ceil((width * depth) / 8), rows = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = y * (stride + 1) + 1 + ((x * depth) >> 3);
    rows[at] |= index[y * width + x] << (8 - depth - ((x * depth) & 7));
  }
  const u32 = (v) => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const chunk = (type, body) => {
    const td = [...type].map((ch) => ch.charCodeAt(0)).concat([...body]);
    return [...u32(body.length), ...td, ...u32(crc32(td))];
  };
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk("IHDR", [...u32(width), ...u32(height), depth, 3, 0, 0, 0]),
    ...chunk("PLTE", palette.flat()),
    ...(clear ? chunk("tRNS", [0]) : []),
    ...chunk("IDAT", deflate(rows)),
    ...chunk("IEND", []),
  ]);
}
