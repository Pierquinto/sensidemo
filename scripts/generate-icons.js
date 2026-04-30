const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "assets", "icons");
const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(OUT_DIR, `sensidemo-${size}.png`), png);
}

function renderIcon(size) {
  const scale = 4;
  const canvasSize = size * scale;
  const pixels = new Uint8ClampedArray(canvasSize * canvasSize * 4);

  drawRoundedRect(pixels, canvasSize, 0, 0, canvasSize, canvasSize, 0.22 * canvasSize, [17, 24, 39, 255]);
  drawRoundedGradient(pixels, canvasSize, 0.078 * canvasSize, 0.078 * canvasSize, 0.844 * canvasSize, 0.844 * canvasSize, 0.172 * canvasSize);
  drawCircle(pixels, canvasSize, 0.5 * canvasSize, 0.332 * canvasSize, 0.14 * canvasSize, [255, 255, 255, 236]);
  drawRoundedRect(pixels, canvasSize, 0.28 * canvasSize, 0.47 * canvasSize, 0.44 * canvasSize, 0.266 * canvasSize, 0.09 * canvasSize, [255, 255, 255, 236]);

  drawBand(pixels, canvasSize, 0.17 * canvasSize, 0.27 * canvasSize, 0.83 * canvasSize, 0.27 * canvasSize, 0.064 * canvasSize, [17, 24, 39, 86]);
  drawBand(pixels, canvasSize, 0.14 * canvasSize, 0.41 * canvasSize, 0.86 * canvasSize, 0.41 * canvasSize, 0.064 * canvasSize, [17, 24, 39, 62]);
  drawBand(pixels, canvasSize, 0.19 * canvasSize, 0.55 * canvasSize, 0.81 * canvasSize, 0.55 * canvasSize, 0.064 * canvasSize, [17, 24, 39, 52]);
  drawBand(pixels, canvasSize, 0.26 * canvasSize, 0.75 * canvasSize, 0.74 * canvasSize, 0.75 * canvasSize, 0.064 * canvasSize, [17, 24, 39, 48]);
  drawRoundedStroke(pixels, canvasSize, 0.078 * canvasSize, 0.078 * canvasSize, 0.844 * canvasSize, 0.844 * canvasSize, 0.172 * canvasSize, Math.max(1, 0.015 * canvasSize), [255, 255, 255, 54]);

  const downsampled = downsample(pixels, canvasSize, scale);
  return encodePng(size, size, downsampled);
}

function drawRoundedGradient(pixels, size, x, y, w, h, r) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) {
      if (insideRoundedRect(px + 0.5, py + 0.5, x, y, w, h, r)) {
        const t = clamp(((px - x) + (py - y)) / (w + h), 0, 1);
        const left = mix([124, 58, 237, 255], [37, 99, 235, 255], clamp(t / 0.48, 0, 1));
        const right = mix([37, 99, 235, 255], [6, 182, 212, 255], clamp((t - 0.48) / 0.52, 0, 1));
        blendPixel(pixels, size, px, py, t <= 0.48 ? left : right);
      }
    }
  }
}

function drawRoundedRect(pixels, size, x, y, w, h, r, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) {
      if (insideRoundedRect(px + 0.5, py + 0.5, x, y, w, h, r)) {
        blendPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawRoundedStroke(pixels, size, x, y, w, h, r, stroke, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      if (insideRoundedRect(cx, cy, x, y, w, h, r) && !insideRoundedRect(cx, cy, x + stroke, y + stroke, w - stroke * 2, h - stroke * 2, Math.max(0, r - stroke))) {
        blendPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawCircle(pixels, size, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let py = Math.floor(cy - radius); py < Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px < Math.ceil(cx + radius); px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        blendPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawBand(pixels, size, x1, y1, x2, y2, width, color) {
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const half = width / 2;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distance = distanceToSegment(px + 0.5, py + 0.5, x1, y1, x2, y2);
      if (distance <= half) {
        blendPixel(pixels, size, px, py, color);
      }
    }
  }
}

function insideRoundedRect(px, py, x, y, w, h, r) {
  const nearestX = clamp(px, x + r, x + w - r);
  const nearestY = clamp(py, y + r, y + h - r);
  const dx = px - nearestX;
  const dy = py - nearestY;
  return px >= x && px <= x + w && py >= y && py <= y + h && dx * dx + dy * dy <= r * r;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / length2, 0, 1);
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function blendPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;

  const index = (y * size + x) * 4;
  const alpha = color[3] / 255;
  const invAlpha = 1 - alpha;
  pixels[index] = Math.round(color[0] * alpha + pixels[index] * invAlpha);
  pixels[index + 1] = Math.round(color[1] * alpha + pixels[index + 1] * invAlpha);
  pixels[index + 2] = Math.round(color[2] * alpha + pixels[index + 2] * invAlpha);
  pixels[index + 3] = Math.round(255 * (alpha + (pixels[index + 3] / 255) * invAlpha));
}

function downsample(pixels, size, scale) {
  const outSize = size / scale;
  const out = Buffer.alloc(outSize * outSize * 4);

  for (let y = 0; y < outSize; y += 1) {
    for (let x = 0; x < outSize; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = (((y * scale + sy) * size) + (x * scale + sx)) * 4;
          sums[0] += pixels[index];
          sums[1] += pixels[index + 1];
          sums[2] += pixels[index + 2];
          sums[3] += pixels[index + 3];
        }
      }
      const outIndex = (y * outSize + x) * 4;
      out[outIndex] = Math.round(sums[0] / (scale * scale));
      out[outIndex + 1] = Math.round(sums[1] / (scale * scale));
      out[outIndex + 2] = Math.round(sums[2] / (scale * scale));
      out[outIndex + 3] = Math.round(sums[3] / (scale * scale));
    }
  }

  return out;
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t)
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
