import { PRODUCTION_V1_LIMITS } from "./production-limits";
import { hydrateCloudAsset } from "./cloud-assets";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { isTrustedHydratedCloudAsset, type TrustedCloudAssetKind } from "./cloud-asset-trust";

export const AUTHORED_PROJECT_IMAGE_MAX_EDGE_PX = 1800;
// The largest V1 authored logo box is under 40 mm; 400 px remains above 250 effective DPI.
export const AUTHORED_LOGO_IMAGE_MAX_EDGE_PX = 400;
export const AUTHORED_PROJECT_JPEG_QUALITY = 0.82;

export type AuthoredImageOptimization = Readonly<{
  source: string;
  originalBytes: number;
  optimizedBytes: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  format: "PNG" | "JPEG";
  transparencyPreserved: boolean;
  effectiveArtworkBounds: Readonly<{ x: number; y: number; width: number; height: number }> | null;
}>;

const decodedBytes = (source: string) => {
  const payload = source.slice(source.indexOf(",") + 1).replace(/\s/g, "");
  return Math.max(0, Math.floor(payload.length * 3 / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0));
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Could not decode authored project image for PDF optimization."));
  image.src = source;
});

const dataUrlFromBytes = (bytes: ArrayBuffer, contentType: string): string => {
  const binary = Array.from(new Uint8Array(bytes), (value) => String.fromCharCode(value)).join("");
  return `data:${contentType};base64,${btoa(binary)}`;
};

const fetchTrustedImage = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error("cloud_asset_fetch_failed");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
    if (contentType !== "image/png" && contentType !== "image/jpeg") throw new Error("image_format_limit");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > PRODUCTION_V1_LIMITS.imageBytes) throw new Error("image_byte_limit");
    return dataUrlFromBytes(bytes, contentType);
  } finally {
    window.clearTimeout(timeout);
  }
};

export const materializeTrustedAuthoredImage = async (source: string, path: string | undefined, profileId: string | undefined, kind: TrustedCloudAssetKind, client = getSupabaseBrowserClient()): Promise<string> => {
  if (/^data:image\/(png|jpe?g);base64,/i.test(source)) return source;
  if (!profileId || !isTrustedHydratedCloudAsset(source, path, kind, profileId)) throw new Error("image_format_limit");
  try {
    return await fetchTrustedImage(source);
  } catch (error) {
    if (error instanceof Error && ["image_byte_limit", "image_format_limit"].includes(error.message)) throw error;
    const refreshed = client && path ? await hydrateCloudAsset(path, profileId, client, kind) : "";
    if (!refreshed) throw new Error("cloud_asset_refresh_failed");
    return fetchTrustedImage(refreshed);
  }
};

const canvasHasTransparency = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 255) return true;
  return false;
};

const transparentArtworkBounds = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width; let top = height; let right = -1; let bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (pixels[(y * width + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

const cache = new Map<string, Promise<AuthoredImageOptimization>>();

const optimizeAuthoredImage = (source: string, maximumEdge: number, path?: string, profileId?: string, kind: TrustedCloudAssetKind = "project"): Promise<AuthoredImageOptimization> => {
  const cacheKey = `${maximumEdge}:${profileId ?? ""}:${path ?? ""}:${source}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = (async () => {
    const materializedSource = await materializeTrustedAuthoredImage(source, path, profileId, kind);
    const image = await loadImage(materializedSource);
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) throw new Error("Authored project image has invalid dimensions.");
    if (originalWidth > PRODUCTION_V1_LIMITS.imageDimensionPx || originalHeight > PRODUCTION_V1_LIMITS.imageDimensionPx) throw new Error("image_dimension_limit");
    const scale = Math.min(1, maximumEdge / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Could not prepare authored project image.");
    context.drawImage(image, 0, 0, width, height);
    const inputIsPng = /^data:image\/png;base64,/i.test(materializedSource);
    const transparencyPreserved = inputIsPng && canvasHasTransparency(context, width, height);
    const scaledBounds = transparencyPreserved ? transparentArtworkBounds(context, width, height) : null;
    const safelyTrimmed = scaledBounds && (scaledBounds.x > 0 || scaledBounds.y > 0 || scaledBounds.width < width || scaledBounds.height < height);
    let outputCanvas = canvas;
    if (safelyTrimmed) {
      outputCanvas = document.createElement("canvas"); outputCanvas.width = scaledBounds.width; outputCanvas.height = scaledBounds.height;
      const outputContext = outputCanvas.getContext("2d", { alpha: true });
      if (!outputContext) throw new Error("Could not prepare authored logo artwork bounds.");
      outputContext.drawImage(canvas, scaledBounds.x, scaledBounds.y, scaledBounds.width, scaledBounds.height, 0, 0, scaledBounds.width, scaledBounds.height);
    }
    const format = transparencyPreserved ? "PNG" as const : "JPEG" as const;
    const originalBytes = decodedBytes(materializedSource);
    const candidate = outputCanvas.toDataURL(transparencyPreserved ? "image/png" : "image/jpeg", AUTHORED_PROJECT_JPEG_QUALITY);
    const optimizedBytes = decodedBytes(candidate);
    const useCandidate = scale < 1 || Boolean(safelyTrimmed) || optimizedBytes < originalBytes;
    const outputWidth = useCandidate ? outputCanvas.width : originalWidth;
    const outputHeight = useCandidate ? outputCanvas.height : originalHeight;
    return {
      source: useCandidate ? candidate : materializedSource,
      originalBytes,
      optimizedBytes: useCandidate ? optimizedBytes : originalBytes,
      originalWidth,
      originalHeight,
      width: outputWidth,
      height: outputHeight,
      format: useCandidate ? format : inputIsPng ? "PNG" : "JPEG",
      transparencyPreserved,
      effectiveArtworkBounds: scaledBounds ? {
        x: Math.round(scaledBounds.x / scale), y: Math.round(scaledBounds.y / scale),
        width: Math.round(scaledBounds.width / scale), height: Math.round(scaledBounds.height / scale),
      } : null,
    };
  })();
  cache.set(cacheKey, pending);
  return pending;
};

export const optimizeAuthoredProjectImage = (source: string, path?: string, profileId?: string) => optimizeAuthoredImage(source, AUTHORED_PROJECT_IMAGE_MAX_EDGE_PX, path, profileId, "project");
export const optimizeAuthoredLogoImage = (source: string, path?: string, profileId?: string) => optimizeAuthoredImage(source, AUTHORED_LOGO_IMAGE_MAX_EDGE_PX, path, profileId, "logo");

export const optimizeAuthoredProjectImages = async <T extends { imageUrl: string; imagePath?: string }>(projects: readonly T[], profileId?: string) => {
  const optimizedBySource = new Map<string, AuthoredImageOptimization>();
  const optimized = await Promise.all(projects.map(async (project) => {
    const result = await optimizeAuthoredProjectImage(project.imageUrl, project.imagePath, profileId);
    optimizedBySource.set(project.imageUrl, result);
    return { ...project, imageUrl: result.source };
  }));
  return { projects: optimized, images: [...optimizedBySource.values()] };
};
