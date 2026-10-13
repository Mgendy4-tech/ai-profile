import sharp from "sharp";

export const VISION_MAX_BYTES = 8 * 1024 * 1024;
export const VISION_MAX_DIMENSION = 1600;
const VISION_FETCH_TIMEOUT_MS = 15_000;

export type VisionImageNormalizationInput = {
  imageUrl: string;
  providerUrls?: readonly string[];
};

export type VisionImageNormalizationResult = {
  imageUrl: string;
  sourceUrl: string;
  sourceBytes: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceContentType: string;
  scoringBytes: number;
  scoringWidth: number;
  scoringHeight: number;
  scoringContentType: "image/jpeg";
};

const uniqueUrls = (input: VisionImageNormalizationInput) =>
  [...new Set([...(input.providerUrls ?? []), input.imageUrl].filter(Boolean))];

const readDataUrl = (value: string) => {
  const match = value.match(/^data:(image\/[^;]+);base64,(.+)$/i);
  if (!match) return null;
  return { bytes: Buffer.from(match[2], "base64"), contentType: match[1].toLowerCase(), sourceUrl: value };
};

const readRemoteImage = async (url: string) => {
  const dataUrl = readDataUrl(url);
  if (dataUrl) return dataUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Vision image fetch failed with status ${response.status}.`);
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() || "application/octet-stream",
      sourceUrl: url,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const renderScoringInput = async (bytes: Buffer) => {
  const source = sharp(bytes, { failOn: "error" });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Vision image dimensions could not be read.");

  const attempts = [
    { dimension: VISION_MAX_DIMENSION, quality: 82 },
    { dimension: VISION_MAX_DIMENSION, quality: 70 },
    { dimension: 1280, quality: 62 },
    { dimension: 1024, quality: 52 },
  ];

  for (const attempt of attempts) {
    const output = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({ width: attempt.dimension, height: attempt.dimension, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: attempt.quality, progressive: true, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (output.data.byteLength <= VISION_MAX_BYTES) {
      return {
        bytes: output.data,
        width: output.info.width,
        height: output.info.height,
        contentType: "image/jpeg" as const,
      };
    }
  }

  throw new Error(`Vision image remained above ${VISION_MAX_BYTES} bytes after normalization.`);
};

export const normalizeVisionImage = async (
  input: VisionImageNormalizationInput
): Promise<VisionImageNormalizationResult> => {
  let lastError: unknown;

  for (const url of uniqueUrls(input)) {
    try {
      const source = await readRemoteImage(url);
      const metadata = await sharp(source.bytes, { failOn: "error" }).metadata();
      if (!metadata.width || !metadata.height) throw new Error("Vision image dimensions could not be read.");
      const scoring = await renderScoringInput(source.bytes);

      return {
        imageUrl: `data:image/jpeg;base64,${scoring.bytes.toString("base64")}`,
        sourceUrl: source.sourceUrl,
        sourceBytes: source.bytes.byteLength,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
        sourceContentType: source.contentType,
        scoringBytes: scoring.bytes.byteLength,
        scoringWidth: scoring.width,
        scoringHeight: scoring.height,
        scoringContentType: scoring.contentType,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Vision image normalization failed.");
};
