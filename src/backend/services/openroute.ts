/**
 * @fileoverview Service for interacting with the HeiGIT OpenRoute API.
 * Uses the new api.heigit.org base URL as the openrouteservice.org domain is deprecated.
 */

import { getOpenRouteApiKey } from "@/backend/utils/secrets";

export interface OpenRouteDirectionsResponse {
  features?: Array<{
    properties?: {
      segments?: Array<{
        distance: number;
        duration: number;
      }>;
      summary?: {
        distance: number;
        duration: number;
      };
    };
  }>;
}

export class OpenRouteService {
  private readonly baseUrl = "https://api.heigit.org";

  constructor(private readonly env: Env) {}

  /**
   * Helper to execute API calls to the OpenRoute/HeiGIT service
   */
  private async fetchOpenRoute(path: string, body?: any): Promise<any> {
    const apiKey = await getOpenRouteApiKey(this.env);
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: apiKey,
    };

    const options: RequestInit = {
      headers,
    };

    if (body) {
      options.method = "POST";
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    } else {
      options.method = "GET";
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouteService error: ${res.status} ${text}`);
    }

    return res.json();
  }

  /**
   * Geocode a human-readable address into coordinates using Pelias.
   * Note: The Pelias endpoint requires the api_key in the URL.
   * @param query The location/address query string
   * @returns [longitude, latitude] or null if not found
   */
  async geocode(query: string): Promise<[number, number] | null> {
    const apiKey = await getOpenRouteApiKey(this.env);
    const url = `${this.baseUrl}/pelias/v1/search?text=${encodeURIComponent(query)}&api_key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Geocode error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const features = data.features;
    if (!features || features.length === 0) return null;

    // Pelias returns coordinates as [longitude, latitude]
    return features[0].geometry.coordinates as [number, number];
  }

  /**
   * Get driving directions (car) between two coordinates.
   * Coordinates must be in [longitude, latitude] format.
   * @returns Distance in meters and duration in seconds
   */
  async getDrivingDirections(
    startCoords: [number, number],
    endCoords: [number, number],
  ): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
    try {
      const data = (await this.fetchOpenRoute("/openrouteservice/v2/directions/driving-car", {
        coordinates: [startCoords, endCoords],
      })) as OpenRouteDirectionsResponse;

      const summary = data.features?.[0]?.properties?.summary;
      if (summary) {
        return {
          distanceMeters: summary.distance,
          durationSeconds: summary.duration,
        };
      }
      return null;
    } catch (e) {
      console.warn("Failed to get driving directions:", e);
      return null;
    }
  }

  /**
   * Helper to get a full commute summary (driving) by geocoding address strings.
   * Handles errors internally to allow for graceful fallbacks.
   */
  async getCommuteSummary(
    startAddress: string,
    endAddress: string,
  ): Promise<
    | {
        distanceMiles: number;
        durationMinutes: number;
        success: true;
      }
    | { success: false; error: string }
  > {
    try {
      const startCoords = await this.geocode(startAddress);
      if (!startCoords)
        return { success: false, error: `Could not geocode start address: ${startAddress}` };

      const endCoords = await this.geocode(endAddress);
      if (!endCoords)
        return { success: false, error: `Could not geocode end address: ${endAddress}` };

      const directions = await this.getDrivingDirections(startCoords, endCoords);
      if (!directions) return { success: false, error: "No route found between locations." };

      return {
        success: true,
        distanceMiles: directions.distanceMeters * 0.000621371, // meters to miles
        durationMinutes: Math.round(directions.durationSeconds / 60), // seconds to minutes
      };
    } catch (e) {
      const err = e as Error;
      return { success: false, error: err.message };
    }
  }
}
