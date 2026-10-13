import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  normalizeVisionImage,
  VISION_MAX_BYTES,
  VISION_MAX_DIMENSION,
} from "./vision-image-normalizer";

const dataUrl = (contentType: string, bytes: Buffer) =>
  `data:${contentType};base64,${bytes.toString("base64")}`;

const run = async () => {
  const normalBytes = readFileSync("lib/test-fixtures/visual/aurelia-browser-upload.jpg");
  const normal = await normalizeVisionImage({ imageUrl: dataUrl("image/jpeg", normalBytes) });
  assert.equal(normal.sourceBytes, normalBytes.byteLength);
  assert.equal(normal.scoringContentType, "image/jpeg");
  assert(normal.scoringBytes <= VISION_MAX_BYTES);
  assert(normal.scoringWidth <= VISION_MAX_DIMENSION);
  assert(normal.scoringHeight <= VISION_MAX_DIMENSION);

  const width = 4000;
  const height = 3000;
  const raw = Buffer.alloc(width * height * 3);
  let state = 0x12345678;
  for (let index = 0; index < raw.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    raw[index] = state >>> 24;
  }
  const oversizedPng = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const oversized = await normalizeVisionImage({ imageUrl: dataUrl("image/png", oversizedPng) });
  assert(oversized.sourceBytes > VISION_MAX_BYTES, "The oversized PNG fixture must exercise the byte guard.");
  assert.equal(oversized.sourceContentType, "image/png");
  assert.equal(oversized.scoringContentType, "image/jpeg");
  assert(oversized.scoringBytes <= VISION_MAX_BYTES);
  assert(oversized.scoringWidth <= VISION_MAX_DIMENSION);
  assert(oversized.scoringHeight <= VISION_MAX_DIMENSION);
  assert(Math.abs(oversized.scoringWidth / oversized.scoringHeight - width / height) < 0.01, "Aspect ratio changed during normalization.");
  assert.notEqual(oversized.imageUrl, dataUrl("image/png", oversizedPng), "Scoring input must be normalized separately from the source asset.");

  console.log("Vision image normalization tests passed.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
