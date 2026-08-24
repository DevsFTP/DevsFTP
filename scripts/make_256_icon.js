const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 calculation table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function create256Png() {
  const width = 256;
  const height = 256;

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const isBorder = (x < 12 || x > 244 || y < 12 || y > 244);
      if (isBorder) {
        rawData[offset++] = 0xF5; // R
        rawData[offset++] = 0x9E; // G
        rawData[offset++] = 0x0B; // B
        rawData[offset++] = 0xFF; // A
      } else {
        rawData[offset++] = 0x18; // R
        rawData[offset++] = 0x1B; // G
        rawData[offset++] = 0x1F; // B
        rawData[offset++] = 0xFF; // A
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createIcoFromPng(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  const dir = Buffer.alloc(16);
  dir[0] = 0; // Width 256
  dir[1] = 0; // Height 256
  dir[2] = 0;
  dir[3] = 0;
  dir.writeUInt16LE(1, 4); // Planes
  dir.writeUInt16LE(32, 6); // BPP
  dir.writeUInt32LE(pngBuf.length, 8); // Size
  dir.writeUInt32LE(22, 12); // Offset

  return Buffer.concat([header, dir, pngBuf]);
}

const pngBuf = create256Png();
const icoBuf = createIcoFromPng(pngBuf);

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuf);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuf);

console.log('Successfully generated 256x256 assets/icon.png and assets/icon.ico');
