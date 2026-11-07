function utf8Encode(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var c2 = str.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      i++;
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function utf8Decode(bytes) {
  var parts = [], buf = [];
  var i = 0;
  while (i < bytes.length) {
    var b = bytes[i++];
    if (b < 0x80) buf.push(b);
    else if (b >= 0xc0 && b < 0xe0) {
      buf.push(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b >= 0xe0 && b < 0xf0) {
      buf.push(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    } else {
      var cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      cp -= 0x10000;
      buf.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
    if (buf.length >= 4096) { parts.push(String.fromCharCode.apply(null, buf)); buf = []; }
  }
  if (buf.length) parts.push(String.fromCharCode.apply(null, buf));
  return parts.join("");
}

function bytesToHex(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return s;
}
function hexToBytes(hex) {
  var n = hex.length >> 1, out = new Array(n);
  for (var i = 0; i < n; i++) {
    var h = hex.charCodeAt(2 * i), l = hex.charCodeAt(2 * i + 1);
    out[i] = ((h > 57 ? (h | 32) - 87 : h - 48) << 4) | (l > 57 ? (l | 32) - 87 : l - 48);
  }
  return out;
}

var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Encode(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    s += B64[b0 >> 2];
    s += B64[((b0 & 3) << 4) | (b1 >> 4)];
    s += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    s += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return s;
}
var B64_LUT = (function () {
  var t = new Array(256);
  for (var i = 0; i < 256; i++) t[i] = -1;
  for (var j = 0; j < 64; j++) t[B64.charCodeAt(j)] = j;
  return t;
})();
function base64Decode(str) {
  var vals = [];
  for (var i = 0; i < str.length; i++) {
    var v = B64_LUT[str.charCodeAt(i) & 255];
    if (v !== -1) vals.push(v);
  }
  var out = [];
  for (var j = 0; j < vals.length; j += 4) {
    var c0 = vals[j], c1 = vals[j + 1];
    var c2 = j + 2 < vals.length ? vals[j + 2] : -1;
    var c3 = j + 3 < vals.length ? vals[j + 3] : -1;
    out.push((c0 << 2) | (c1 >> 4));
    if (c2 !== -1) out.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 !== -1) out.push(((c2 & 3) << 6) | c3);
  }
  return out;
}

var MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
];
var MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

function md5Bytes(bytes) {
  var msg = bytes.slice();
  var bitLenLo = (bytes.length * 8) >>> 0;
  var bitLenHi = Math.floor(bytes.length / 536870912);
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  msg.push(bitLenLo & 0xff, (bitLenLo >>> 8) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 24) & 0xff);
  msg.push(bitLenHi & 0xff, (bitLenHi >>> 8) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 24) & 0xff);

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  function rotl(x, c) { return ((x << c) | (x >>> (32 - c))) >>> 0; }
  for (var i = 0; i < msg.length; i += 64) {
    var M = [];
    for (var k = 0; k < 16; k++) {
      M[k] = (msg[i + k * 4]) | (msg[i + k * 4 + 1] << 8) | (msg[i + k * 4 + 2] << 16) | (msg[i + k * 4 + 3] << 24);
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var r = 0; r < 64; r++) {
      var F, g;
      if (r < 16) { F = (B & C) | (~B & D); g = r; }
      else if (r < 32) { F = (D & B) | (~D & C); g = (5 * r + 1) % 16; }
      else if (r < 48) { F = B ^ C ^ D; g = (3 * r + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * r) % 16; }
      F = (F + A + MD5_K[r] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, MD5_S[r])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  var out = [];
  [a0, b0, c0, d0].forEach(function (x) {
    out.push(x & 0xff, (x >>> 8) & 0xff, (x >>> 16) & 0xff, (x >>> 24) & 0xff);
  });
  return out;
}

function md5Hex(str) {
  return bytesToHex(md5Bytes(utf8Encode(str)));
}

var IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
var FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
var E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
var P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
var PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
var PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
var SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
var SBOX = [
  [[14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7], [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8], [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0], [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]],
  [[15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10], [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5], [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15], [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]],
  [[10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8], [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1], [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7], [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]],
  [[7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15], [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9], [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4], [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]],
  [[2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9], [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6], [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14], [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]],
  [[12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11], [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8], [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6], [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]],
  [[4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1], [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6], [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2], [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]],
  [[13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7], [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2], [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8], [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]]
];

function bytesToBits(bytes) {
  var bits = [];
  for (var i = 0; i < bytes.length; i++) {
    for (var b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  return bits;
}
function bitsToBytes(bits) {
  var out = [];
  for (var i = 0; i < bits.length; i += 8) {
    var v = 0;
    for (var b = 0; b < 8; b++) v = (v << 1) | bits[i + b];
    out.push(v);
  }
  return out;
}
function permute(bits, table) {
  var out = [];
  for (var i = 0; i < table.length; i++) out.push(bits[table[i] - 1]);
  return out;
}

function desSubkeys(keyBytes) {
  var keyBits = bytesToBits(keyBytes);
  var pc1 = permute(keyBits, PC1);
  var C = pc1.slice(0, 28), D = pc1.slice(28, 56);
  var keys = [];
  for (var r = 0; r < 16; r++) {
    var sh = SHIFTS[r];
    C = C.slice(sh).concat(C.slice(0, sh));
    D = D.slice(sh).concat(D.slice(0, sh));
    keys.push(permute(C.concat(D), PC2));
  }
  return keys;
}

// ---- Fast table-driven 3DES (32-bit ints, key schedule cached) ----
var SP = [], IPH = [], IPL = [], FPH = [], FPL = [];
var _desReady = false;

function initDesTables() {
  if (_desReady) return;
  var s, v, i, j;
  for (s = 0; s < 8; s++) {
    var tbl = new Array(64);
    for (v = 0; v < 64; v++) {
      var row = ((v >> 4) & 2) | (v & 1);
      var col = (v >> 1) & 15;
      var val = SBOX[s][row][col];
      var bits = [];
      for (i = 0; i < 32; i++) bits.push(0);
      bits[s * 4] = (val >> 3) & 1; bits[s * 4 + 1] = (val >> 2) & 1;
      bits[s * 4 + 2] = (val >> 1) & 1; bits[s * 4 + 3] = val & 1;
      var pb = permute(bits, P);
      var w = 0;
      for (i = 0; i < 32; i++) w = (w << 1) | pb[i];
      tbl[v] = w;
    }
    SP.push(tbl);
  }
  function build(table, H, Lo) {
    for (j = 0; j < 8; j++) {
      var th = new Array(256), tl = new Array(256);
      for (v = 0; v < 256; v++) {
        var b = [];
        for (i = 0; i < 64; i++) b.push(0);
        for (i = 0; i < 8; i++) b[j * 8 + i] = (v >> (7 - i)) & 1;
        var pb = permute(b, table);
        var hi = 0, lo = 0;
        for (i = 0; i < 32; i++) { hi = (hi << 1) | pb[i]; lo = (lo << 1) | pb[32 + i]; }
        th[v] = hi; tl[v] = lo;
      }
      H.push(th); Lo.push(tl);
    }
  }
  build(IP, IPH, IPL);
  build(FP, FPH, FPL);
  _desReady = true;
}

var _ks3Cache = {};
function des3Schedule(keyBytes) {
  var id = keyBytes.join(",");
  if (_ks3Cache[id]) return _ks3Cache[id];
  var sub = [];
  for (var k = 0; k < 3; k++) {
    var raw = desSubkeys(keyBytes.slice(k * 8, k * 8 + 8));
    var enc = new Array(128), dec = new Array(128);
    for (var r = 0; r < 16; r++) {
      for (var s = 0; s < 8; s++) {
        var v = 0;
        for (var b = 0; b < 6; b++) v = (v << 1) | raw[r][s * 6 + b];
        enc[r * 8 + s] = v;
      }
    }
    for (var r2 = 0; r2 < 16; r2++) for (var s2 = 0; s2 < 8; s2++) dec[r2 * 8 + s2] = enc[(15 - r2) * 8 + s2];
    sub.push({ enc: enc, dec: dec });
  }
  var sched = {
    enc: [sub[0].enc, sub[1].dec, sub[2].enc],
    dec: [sub[2].dec, sub[1].enc, sub[0].dec],
  };
  _ks3Cache[id] = sched;
  return sched;
}

var _dL = 0, _dR = 0;
function desRounds(L, R, ks) {
  var s0 = SP[0], s1 = SP[1], s2 = SP[2], s3 = SP[3], s4 = SP[4], s5 = SP[5], s6 = SP[6], s7 = SP[7];
  for (var r = 0, o = 0; r < 16; r++, o += 8) {
    var f = s0[(((R << 5) | (R >>> 27)) & 63) ^ ks[o]]
      ^ s1[(((R << 9) | (R >>> 23)) & 63) ^ ks[o + 1]]
      ^ s2[(((R << 13) | (R >>> 19)) & 63) ^ ks[o + 2]]
      ^ s3[(((R << 17) | (R >>> 15)) & 63) ^ ks[o + 3]]
      ^ s4[(((R << 21) | (R >>> 11)) & 63) ^ ks[o + 4]]
      ^ s5[(((R << 25) | (R >>> 7)) & 63) ^ ks[o + 5]]
      ^ s6[(((R << 29) | (R >>> 3)) & 63) ^ ks[o + 6]]
      ^ s7[(((R << 1) | (R >>> 31)) & 63) ^ ks[o + 7]];
    var t = L ^ f; L = R; R = t;
  }
  // pre-output swap; also exactly the input of the next DES stage (FP and IP cancel)
  _dL = R; _dR = L;
}

function des3Bytes(keyBytes, data, decrypt) {
  initDesTables();
  var sc = des3Schedule(keyBytes);
  var ks = decrypt ? sc.dec : sc.enc;
  var k0 = ks[0], k1 = ks[1], k2 = ks[2];
  var out = new Array(data.length);
  for (var i = 0; i < data.length; i += 8) {
    var L = IPH[0][data[i]] ^ IPH[1][data[i + 1]] ^ IPH[2][data[i + 2]] ^ IPH[3][data[i + 3]]
      ^ IPH[4][data[i + 4]] ^ IPH[5][data[i + 5]] ^ IPH[6][data[i + 6]] ^ IPH[7][data[i + 7]];
    var R = IPL[0][data[i]] ^ IPL[1][data[i + 1]] ^ IPL[2][data[i + 2]] ^ IPL[3][data[i + 3]]
      ^ IPL[4][data[i + 4]] ^ IPL[5][data[i + 5]] ^ IPL[6][data[i + 6]] ^ IPL[7][data[i + 7]];
    desRounds(L, R, k0);
    desRounds(_dL, _dR, k1);
    desRounds(_dL, _dR, k2);
    var a = _dL, b = _dR;
    var a0 = (a >>> 24) & 255, a1 = (a >>> 16) & 255, a2 = (a >>> 8) & 255, a3 = a & 255;
    var b0 = (b >>> 24) & 255, b1 = (b >>> 16) & 255, b2 = (b >>> 8) & 255, b3 = b & 255;
    var oh = FPH[0][a0] ^ FPH[1][a1] ^ FPH[2][a2] ^ FPH[3][a3] ^ FPH[4][b0] ^ FPH[5][b1] ^ FPH[6][b2] ^ FPH[7][b3];
    var ol = FPL[0][a0] ^ FPL[1][a1] ^ FPL[2][a2] ^ FPL[3][a3] ^ FPL[4][b0] ^ FPL[5][b1] ^ FPL[6][b2] ^ FPL[7][b3];
    out[i] = (oh >>> 24) & 255; out[i + 1] = (oh >>> 16) & 255; out[i + 2] = (oh >>> 8) & 255; out[i + 3] = oh & 255;
    out[i + 4] = (ol >>> 24) & 255; out[i + 5] = (ol >>> 16) & 255; out[i + 6] = (ol >>> 8) & 255; out[i + 7] = ol & 255;
  }
  return out;
}

function des3Block(keyBytes, blockBytes, decrypt) { return des3Bytes(keyBytes, blockBytes, decrypt); }

function pkcs7Pad(bytes) { var p = 8 - (bytes.length % 8); var out = bytes.slice(); for (var i = 0; i < p; i++) out.push(p); return out; }
function pkcs7Unpad(bytes) { var p = bytes[bytes.length - 1]; return bytes.slice(0, bytes.length - p); }

function encryptBody(keyBytes, plain) {
  var ct = des3Bytes(keyBytes, pkcs7Pad(utf8Encode(plain)), false);
  return bytesToHex(utf8Encode(base64Encode(ct)));
}
function decryptBody(keyBytes, wireHex) {
  var ct = base64Decode(utf8Decode(hexToBytes(wireHex)));
  return utf8Decode(pkcs7Unpad(des3Bytes(keyBytes, ct, true)));
}

var C = {
  utf8Encode, utf8Decode, bytesToHex, hexToBytes, base64Encode, base64Decode,
  md5Hex, md5Bytes, des3Block, encryptBody, decryptBody
};


var CFG = {
  // CDN fijo. Solo se usa como respaldo si el SLB no responde.
  // Ojo: el host solo responde por http; su certificado https no es válido.
  FIXED_CDN_BASE: "http://yuwc.swzablvpm.com",
  KEY_HEX: "e7af1ed7de1ffddd7bd3fe37ebdffde9ef3fe1ae39edfeb8",
  HOSTS: ["osuhk.m3x8o50te.com", "oogoy.f30c96w8.com"],
  SN: "72e6de096ed1850b68b0324e2867cbc2",
  APP_ID: "com.android.msandroid",
  APK_VERSION: "49902",
  PORTAL: "masnew",
  SYS_VERSION: "2025-08-07 05:40:11_36_16_",
  HEADER_APK_VER: "43404",
  SNTOKEN_SALT: "ntFT65w6itH!lHCPw7D=@qnsFC5adD28",
  UA: "okhttp/3.12.12",
};

var KEY = C.hexToBytes(CFG.KEY_HEX);
var session = { userId: "", userToken: "", jwt: "" };
var authMode = null;
var reauthing = false;

function device() {
  return {
    loginType: "2", appLanguage: "en", apkVersion: CFG.APK_VERSION,
    sysVersion: CFG.SYS_VERSION, appId: CFG.APP_ID,
    hardwareInfo: "ranchu", model: "sdk_gphone64_arm64", product: "sdk_gphone64_arm64",
    cpu: "arm64-v8a", B29: "", reserve1: "", deviceToken: "", sn: CFG.SN, drmId: "", sdkVer: 36,
  };
}
var HEADERS = {
  "Content-Type": "application/json;charset=utf-8",
  apk: CFG.APP_ID, apkVer: CFG.HEADER_APK_VER, spkgVer: CFG.SYS_VERSION, "User-Agent": CFG.UA,
};

function randHex(n) {
  var s = "";
  for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
function randMac() {
  var p = [];
  for (var i = 0; i < 6; i++) p.push(("0" + Math.floor(Math.random() * 256).toString(16)).slice(-2));
  return p.join(":");
}

var SESSION_DEAD = ["aaa100027", "aaa100028"];
var SESSION_TAKEN = ["aaa100083"];
var NO_REAUTH = ["v8/active", "v8/login", "v5/loginOut", "v3/snToken"];

function fetchTimeout(url, opts, ms) {
  if (typeof setTimeout !== "function") return fetch(url, opts);
  return new Promise(function (resolve, reject) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; reject(new Error("timeout")); } }, ms);
    fetch(url, opts).then(
      function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } },
      function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } }
    );
  });
}

var _goodHost = null;
function hostOrder() {
  var list = CFG.HOSTS.slice();
  if (_goodHost && list.indexOf(_goodHost) > 0) {
    list.splice(list.indexOf(_goodHost), 1);
    list.unshift(_goodHost);
  }
  return list;
}

async function callOnce(path, bean, baseFields) {
  var body = {};
  if (baseFields !== false) { body.portalCode = CFG.PORTAL; body.userId = session.userId; body.userToken = session.userToken; }
  if (bean) for (var k in bean) body[k] = bean[k];
  var dev = device();
  for (var d in dev) body[d] = dev[d];
  var wire = C.encryptBody(KEY, JSON.stringify(body));
  var last = null;
  var hosts = hostOrder();
  for (var hi = 0; hi < hosts.length; hi++) {
    var host = hosts[hi];
    try {
      var r = await fetchTimeout("https://" + host + "/api/portalCore/" + path, { method: "POST", headers: HEADERS, body: wire }, 10000);
      var text = await r.text();
      var j = JSON.parse(text);
      _goodHost = host;
      var rc = j.returnCode;
      if (rc !== "0" && rc !== undefined && rc !== null) return { _error: String(rc), _msg: j.errorMessage, _path: path };
      if (typeof j.data === "string" && j.data) return JSON.parse(C.decryptBody(KEY, j.data));
      return j;
    } catch (e) { last = e; }
  }
  return { _error: "exception", _msg: last ? last.message : "no hosts", _path: path };
}

async function call(path, bean, baseFields) {
  var r = await callOnce(path, bean, baseFields);
  if (r && r._error && !reauthing) {
    var code = String(r._error);
    var skip = NO_REAUTH.some(function (p) { return path.indexOf(p) === 0; });
    var recoverable = SESSION_DEAD.indexOf(code) !== -1 || (SESSION_TAKEN.indexOf(code) !== -1 && authMode === "device");
    if (!skip && recoverable && (await reauth())) r = await callOnce(path, bean, baseFields);
  }
  return r;
}

async function reauth() {
  reauthing = true;
  try {
    if (authMode === "account" && session._creds) return false;
    var r = await activate();
    return !!(r && r.userToken);
  } finally { reauthing = false; }
}

async function activate() {
  var bean = { snToken: "", authVersion: "", authCode: "", preCode: "", macAddr: "02:00:00:00:00:00", reserve1: "", openNum: 4, channel: "default", matadata: "", signdata: "" };
  var r = await callOnce("v8/active", bean, false);
  if (r && r.userToken) {
    session.userId = r.userId; session.userToken = r.userToken; session.jwt = r.jwtToken || "";
    authMode = "device";
  }
  return r;
}

async function newAnonymousDevice() {
  var fp = {
    androidId: randHex(16), board: "goldfish_arm64", brand: "google", cpuAbi: "arm64-v8a",
    cpuId: randHex(16), device: "emu64a", diskInfo: "8GB", display: "sdk_gphone64_arm64",
    etheMac: randMac(), fingerprint: "google/sdk_gphone64_arm64/emu64a:14/UE1A.230829.036/11228894:user/release-keys",
    gatewayMac: randMac(), hardware: "ranchu", host: "abfarm", manufacturer: "Google", ramSize: "4GB",
    romSize: "8GB", serialNumber: randHex(16), tags: "release-keys", verId: "", wifiMac: randMac(),
  };
  var saved = CFG.SN;
  CFG.SN = "";
  var r = await callOnce("v3/snToken", fp, false);
  var snToken = r && r.snToken;
  if (!snToken) { CFG.SN = saved; return { _error: "snToken_failed", _detail: r }; }
  var sn = (r.sn || C.md5Hex(snToken + CFG.SNTOKEN_SALT)).toLowerCase();
  CFG.SN = sn;
  var bean = { snToken: snToken, authVersion: "", authCode: "", preCode: "", macAddr: "02:00:00:00:00:00", reserve1: "", openNum: 4, channel: "default", matadata: "", signdata: "" };
  var ar = await callOnce("v8/active", bean, false);
  if (ar && ar.userToken) {
    session.userId = ar.userId; session.userToken = ar.userToken; session.jwt = ar.jwtToken || ""; authMode = "device";
    return { userToken: ar.userToken, sn: sn, snToken: snToken };
  }
  return ar;
}

var _sessionPromise = null;
function ensureSession() {
  if (session.userToken) return Promise.resolve(true);
  if (!_sessionPromise) {
    _sessionPromise = (async function () {
      var r = await activate();
      if (r && r.userToken) return true;
      var ar = await newAnonymousDevice();
      return !!(ar && ar.userToken);
    })().then(
      function (ok) { _sessionPromise = null; return ok; },
      function (e) { _sessionPromise = null; throw e; }
    );
  }
  return _sessionPromise;
}

async function searchItems(query, size, page) {
  var sr = await call("v3/searchByName", { value: query, type: "0", columnId: "", filter: "", pageNum: page || 1, pageSize: size || 30 });
  var items = [];
  var groups = (sr && sr.searchItemList) || [];
  for (var i = 0; i < groups.length; i++) {
    var list = groups[i].itemList || [];
    for (var j = 0; j < list.length; j++) items.push(list[j]);
  }
  return { raw: sr, items: items };
}

function norm(s) {
  s = (s || "").toLowerCase();
  // Translitera acentos (é→e, ñ→n…) para que "Pokémon" y "Pokemon" coincidan.
  if (typeof s.normalize === "function") {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } else {
    s = s.replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
      .replace(/[óòöôõ]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n").replace(/ç/g, "c");
  }
  return s.replace(/[^a-z0-9]/g, "");
}
// Marcadores de temporada que usa el portal: "T1", "S01", "Season 2", "Temporada 3", "Temp.1".
var SEASON_RE = /(^|\s)(?:season|temporada|temp|t|s)\.?\s*(\d+)\b/i;
function stripSeason(s) {
  return (s || "").replace(new RegExp(SEASON_RE.source, "gi"), " ").replace(/\s+/g, " ").trim();
}

async function find(name, year, kind, season) {
  year = String(year || "").slice(0, 4);
  var seasonWanted = season != null && season !== "" ? parseInt(season, 10) : null;
  var res = await searchItems(name, 50, 1);
  var wanted = kind === "series" ? "teleplay" : "movie";
  var nq = norm(name);
  var best = null, bestScore = 0;
  for (var i = 0; i < res.items.length; i++) {
    var it = res.items[i];
    var nameRaw = it.name || "";
    var aliasRaw = it.alias || "";
    var bases = [norm(stripSeason(nameRaw)), norm(stripSeason(aliasRaw))];
    var nameScore = 0;
    for (var b = 0; b < bases.length; b++) {
      var nb = bases[b];
      if (!nb || !nq) continue;
      if (nb === nq) nameScore = Math.max(nameScore, 100);
      else if (nb.indexOf(nq) !== -1 || nq.indexOf(nb) !== -1) nameScore = Math.max(nameScore, 40);
      else if (nb.indexOf(nq.slice(0, 6)) === 0 || nq.indexOf(nb.slice(0, 6)) === 0) nameScore = Math.max(nameScore, 15);
    }
    // Server also matches actorDisplay (e.g. "Vilma Vera"), so require
    // a real title/alias match. Otherwise S/T bonuses alone win.
    if (nameScore <= 0) continue;
    var score = nameScore;
    if ((it.programType || "") === wanted) score += 20;
    var ry = String(it.releaseTime || "").slice(0, 4);
    if (year && ry === year) score += 20;
    else if (year && ry) score -= 30; // año distinto: señal leve en contra
    if (seasonWanted != null && kind === "series") {
      var m = (nameRaw + " " + aliasRaw).match(SEASON_RE);
      var s = m ? parseInt(m[2], 10) : null;
      if (s === seasonWanted) score += 120;
      else if (s != null) score -= 200;
    }
    if (score > bestScore) { bestScore = score; best = it; }
  }
  if (!best || bestScore <= 0) return null;
  return { contentId: best.contentId, name: best.name, year: String(best.releaseTime || "").slice(0, 4), score: bestScore };
}

var _epCache = {};
async function episodes(seriesId) {
  if (_epCache[seriesId]) return _epCache[seriesId];
  var list = await episodesFetch(seriesId);
  if (list.length) _epCache[seriesId] = list;
  return list;
}

async function episodesFetch(seriesId) {
  var d = await call("v4/getItemData", { contentId: seriesId, type: "0", sortType: "0", language: "es", macAddr: "02:00:00:00:00:00" });
  var ad = (d && d.assetData) || {};
  return ad.simpleProgramList || [];
}

async function episodeNumber(seriesId, number) {
  var eps = await episodes(seriesId);
  for (var i = 0; i < eps.length; i++) {
    var num = parseInt(eps[i].seriesNumber || eps[i].number || 0, 10);
    if (num === number) return eps[i].contentId;
  }
  if (eps.length && number >= 1 && number <= eps.length) return eps[number - 1].contentId;
  return null;
}

function resolveVod(play) {
  if (!play || !play.episodeList || !play.episodeList[0]) return { streams: [], subtitles: [] };
  var ep = play.episodeList[0];
  var streams = [];
  var total = ep.totalMovieList || [];
  for (var i = 0; i < total.length; i++) {
    var movies = total[i].movieList || [];
    for (var j = 0; j < movies.length; j++) {
      var m = movies[j];
      if (!m.contentId) continue;
      var fmt = m.videoFormat || "mp4";
      var ext = fmt === "ts" ? "ts" : "mp4";
      streams.push({
        url: "/vod/" + m.contentId + "_media." + ext,
        encode_format: m.encodeFormat || "h264",
        quality: m.quality || "?", audio: m.audioInfo || "",
      });
    }
  }
  streams.sort(function (a, b) { return (a.encode_format === "h264" ? 0 : 1) - (b.encode_format === "h264" ? 0 : 1); });
  var subs = [];
  var subsList = ep.subtitleList || [];
  for (var s = 0; s < subsList.length; s++) {
    var files = subsList[s].file || [];
    if (files[0] && files[0].url) subs.push({ lang: subsList[s].language || "?", url: files[0].url });
  }
  return { streams: streams, subtitles: subs };
}

async function playVod(contentId, seriesId) {
  return call("v10/startPlayVOD", { contentId: contentId, seriesContentId: seriesId || "", startTime: 0, type: "1", columnId: 0, authType: "" });
}

function hostOf(u) {
  return (u || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

// Bases de CDN en orden de preferencia. Manda el SLB (dirección fresca y correcta);
// el CDN fijo queda solo como último respaldo si el SLB no responde.
// Se deduplica por host, así http/https del mismo servidor no cuentan como dos fuentes.
async function cdnAuth() {
  var bases = [], seen = {};
  function add(base) {
    base = (base || "").replace(/\/+$/, "");
    var h = hostOf(base);
    if (!h || seen[h]) return;
    seen[h] = true;
    bases.push(base);
  }
  var slb = await call("v14/getSlbInfo", {
    hasPay: "0", userIdentity: "1", type: "merge", appVer: CFG.APK_VERSION, lang: "es",
    encMediaSupported: 1, liveCodeList: ["masnew_live"], appParams: "", reserve1: "02:00:00:00:00:00", pipFlag: "0",
  });
  var list = (slb && slb.cdn_list) || [];
  for (var i = 0; i < list.length; i++) {
    var cdn = list[i];
    if (cdn.tag !== "vod") continue;
    var urls = cdn.url_list || [];
    for (var j = 0; j < urls.length; j++) {
      var u = urls[j].url || "";
      if (u.indexOf("sign_type=cfl") !== -1 && urls[j].tag === "free") {
        add(cdn.main_addr);
        break;
      }
    }
  }
  add(CFG.FIXED_CDN_BASE);
  return { cdn_base: bases[0] || "", cdn_bases: bases };
}




var CDN_TTL = 20 * 60 * 1000;
var _cdnCache = null, _cdnAt = 0, _cdnPromise = null;
function cdnFallback() {
  var fixed = (CFG.FIXED_CDN_BASE || "").replace(/\/+$/, "");
  return fixed ? { cdn_base: fixed, cdn_bases: [fixed] } : { cdn_base: "", cdn_bases: [] };
}
function cdnAuthCached() {
  if (_cdnCache && Date.now() - _cdnAt < CDN_TTL) return Promise.resolve(_cdnCache);
  if (!_cdnPromise) {
    _cdnPromise = cdnAuth().then(
      function (c) { if (c && c.cdn_base) { _cdnCache = c; _cdnAt = Date.now(); } _cdnPromise = null; return c || cdnFallback(); },
      function () { _cdnPromise = null; return cdnFallback(); }
    );
  }
  return _cdnPromise;
}

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var _tmdbCache = {};
var _findCache = {};

async function tmdbInfo(tmdbId, mediaType) {
  var key = mediaType + ":" + tmdbId;
  if (_tmdbCache[key]) return _tmdbCache[key];
  var titleKey = mediaType === "movie" ? "title" : "name";
  var origKey = mediaType === "movie" ? "original_title" : "original_name";
  var dateKey = mediaType === "movie" ? "release_date" : "first_air_date";
  var langs = ["es-MX", "es-ES", "en-US"];
  var res = await Promise.all(langs.map(function (l) {
    return fetch("https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=" + l)
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }));
  var pick = null;
  for (var i = 0; i < res.length; i++) { if (res[i] && res[i][titleKey]) { pick = res[i]; break; } }
  if (!pick) return null;
  var names = [];
  for (var j = 0; j < res.length; j++) {
    var d = res[j];
    if (!d) continue;
    if (d[titleKey] && names.indexOf(d[titleKey]) === -1) names.push(d[titleKey]);
    if (d[origKey] && names.indexOf(d[origKey]) === -1) names.push(d[origKey]);
  }
  var info = { names: names, year: String(pick[dateKey] || "").slice(0, 4) };
  _tmdbCache[key] = info;
  return info;
}

async function findCached(name, year, kind, season) {
  var key = kind + "|" + norm(name) + "|" + (year || "") + "|" + (season == null ? "" : season);
  if (_findCache[key] !== undefined) return _findCache[key];
  var hit = await find(name, year, kind, season);
  _findCache[key] = hit || null;
  return hit;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) return [];
    if (mediaType === "tv" && (!season || !episode)) return [];
    // TMDB lookup and login run in parallel
    var pre = await Promise.all([tmdbInfo(tmdbId, mediaType), ensureSession()]);
    var info = pre[0];
    if (!info || !info.names.length) return [];
    console.log("[Max] TMDB " + mediaType + " " + tmdbId + " -> " + JSON.stringify(info.names) + " (" + info.year + ")");

    if (!pre[1]) { console.log("[Max] sin sesión"); return []; }

    // CDN info doesn't depend on the match: fetch it while we search
    var cdnPromise = cdnAuthCached();

    var kind = mediaType === "tv" ? "series" : "movie";
    var seasonArg = mediaType === "tv" ? season : null;
    // Try every TMDB alias (e.g. ["Vilma","Velma"]) and keep the best
    // score instead of stopping at the first hit.
    var found = null, foundScore = -1;
    for (var i = 0; i < info.names.length; i++) {
      var hit = await findCached(info.names[i], info.year, kind, seasonArg);
      if (hit && hit.contentId && hit.score > foundScore) { foundScore = hit.score; found = hit; }
    }
    if (!found) { console.log("[Max] sin coincidencia"); return []; }
    console.log("[Max] match: " + found.name + " (" + found.year + ") score=" + found.score);

    var contentId = found.contentId;
    var seriesId = "";
    if (mediaType === "tv") {
      var epc = await episodeNumber(found.contentId, parseInt(episode, 10) || 1);
      if (!epc) { console.log("[Max] episodio no encontrado"); return []; }
      contentId = epc;
      seriesId = found.contentId;
    }

    var play = await playVod(contentId, seriesId);
    var resolved = resolveVod(play);
    if (!resolved.streams.length) { console.log("[Max] sin streams: " + JSON.stringify(play).slice(0, 200)); return []; }

    var cdn = await cdnPromise;
    var bases = (cdn && cdn.cdn_bases) || [];
    if (!bases.length && cdn && cdn.cdn_base) bases = [cdn.cdn_base];
    if (!bases.length) { console.log("[Max] sin cdn_base"); return []; }

    var subs = resolved.subtitles.length
      ? resolved.subtitles.map(function (x) { return { id: x.lang, url: x.url, lang: x.lang }; })
      : null;

    var out = [];
    for (var s = 0; s < resolved.streams.length; s++) {
      var st = resolved.streams[s];
      var label = [st.quality, st.encode_format, st.audio].filter(function (x) { return x && x !== "?"; }).join(" · ");
      // Una opción por CDN: la principal primero y el respaldo (CDN fijo) después,
      // así si una URL falla el reproductor puede usar la siguiente.
      var targets = st.url.indexOf("http") === 0
        ? [{ url: st.url, tag: "" }]
        : bases.map(function (b, i) { return { url: b + st.url, tag: i === 0 ? "" : hostOf(b) }; });
      for (var t = 0; t < targets.length; t++) {
        var title = label || "Max";
        if (targets[t].tag) title += " · " + targets[t].tag;
        var item = {
          name: "Max",
          title: title,
          url: targets[t].url,
          quality: st.quality && st.quality !== "?" ? st.quality : "HD",
          headers: { "User-Agent": "Ranger/4.9.4-17294ac0" },
        };
        if (subs) item.subtitles = subs;
        out.push(item);
      }
    }
    console.log("[Max] " + out.length + " stream(s)");
    return out;
  } catch (e) {
    console.log("[Max] error: " + ((e && e.message) || e));
    return [];
  }
}

module.exports = { getStreams: getStreams };