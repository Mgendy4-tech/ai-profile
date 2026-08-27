export type PexelsImageCandidate = {
  candidateId: string;
  url: string;
  source: "pexels";
  photographer: string;
  width: number;
  height: number;
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  src: {
    original: string;
    large2x?: string;
    large?: string;
  };
};

type PexelsSearchResponse = {
  photos: PexelsPhoto[];
};

export type PexelsOrientation =
  | "landscape"
  | "portrait"
  | "square";

export const searchPexelsImages = async (
  query: string,
  perPage = 10,
  orientation?: PexelsOrientation
): Promise<PexelsImageCandidate[]> => {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    emitProductionTelemetry({ name: "external_api_failed", failureClass: "external_api_failure", provider: "pexels", operation: "image_search", reasonCode: "pexels_configuration_missing" });
    throw new Error("Missing PEXELS_API_KEY.");
  }

  const url = new URL("https://api.pexels.com/v1/search");

  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));

  if (orientation) {
    url.searchParams.set("orientation", orientation);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    emitProductionTelemetry({ name: "external_api_failed", failureClass: "external_api_failure", provider: "pexels", operation: "image_search", reasonCode: `pexels_${response.status}` });
    throw new Error(
      `Pexels request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as PexelsSearchResponse;

  return data.photos.map((photo) => ({
    candidateId: `pexels-${photo.id}`,
    url: photo.src.original,
    source: "pexels",
    photographer: photo.photographer,
    width: photo.width,
    height: photo.height,
  }));
};
import { emitProductionTelemetry } from "../production-telemetry";
