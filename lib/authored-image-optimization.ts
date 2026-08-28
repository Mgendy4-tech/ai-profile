import { PRODUCTION_V1_LIMITS } from "./production-limits";

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

const canvasHasTransparency = (context: CanvasRenderingContext2D, width: number, height: number) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 255) return true;
  return false;
};

const cache = new Map<string, Promise<AuthoredImageOptimization>>();

const optimizeAuthoredImage = (source: string, maximumEdge: number): Promise<AuthoredImageOptimization> => {
  const cacheKey = `${maximumEdge}:${source}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = (async () => {
    const image = await loadImage(source);
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
    const inputIsPng = /^data:image\/png;base64,/i.test(source);
    const transparencyPreserved = inputIsPng && canvasHasTransparency(context, width, height);
    const format = transparencyPreserved ? "PNG" as const : "JPEG" as const;
    const originalBytes = decodedBytes(source);
    const candidate = canvas.toDataURL(transparencyPreserved ? "image/png" : "image/jpeg", AUTHORED_PROJECT_JPEG_QUALITY);
    const optimizedBytes = decodedBytes(candidate);
    const useCandidate = scale < 1 || optimizedBytes < originalBytes;
    return {
      source: useCandidate ? candidate : source,
      originalBytes,
      optimizedBytes: useCandidate ? optimizedBytes : originalBytes,
      originalWidth,
      originalHeight,
      width: useCandidate ? width : originalWidth,
      height: useCandidate ? height : originalHeight,
      format: useCandidate ? format : inputIsPng ? "PNG" : "JPEG",
      transparencyPreserved,
    };
  })();
  cache.set(cacheKey, pending);
  return pending;
};

export const optimizeAuthoredProjectImage = (source: string) => optimizeAuthoredImage(source, AUTHORED_PROJECT_IMAGE_MAX_EDGE_PX);
export const optimizeAuthoredLogoImage = (source: string) => optimizeAuthoredImage(source, AUTHORED_LOGO_IMAGE_MAX_EDGE_PX);

export const optimizeAuthoredProjectImages = async <T extends { imageUrl: string }>(projects: readonly T[]) => {
  const optimizedBySource = new Map<string, AuthoredImageOptimization>();
  const optimized = await Promise.all(projects.map(async (project) => {
    const result = await optimizeAuthoredProjectImage(project.imageUrl);
    optimizedBySource.set(project.imageUrl, result);
    return { ...project, imageUrl: result.source };
  }));
  return { projects: optimized, images: [...optimizedBySource.values()] };
};
