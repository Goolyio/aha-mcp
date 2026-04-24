import type { User } from "./models/user.js";
import { QUERY_GET_FEATURES, type FeaturesResponse } from "./queries.js";

const { AHA_API_TOKEN, AHA_DOMAIN } = process.env;

if (!AHA_API_TOKEN) throw new Error("Missing required environment variable: AHA_API_TOKEN");
if (!AHA_DOMAIN) throw new Error("Missing required environment variable: AHA_DOMAIN");

const BASE_URL = `https://${AHA_DOMAIN}.aha.io`;
const GRAPHQL_URL = `${BASE_URL}/api/v2/graphql`;

const AUTH_HEADERS = {
  Authorization: `Bearer ${AHA_API_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── Cached current user ──────────────────────────────────────────────────────

let cachedMe: User | null = null;

// ─── Core HTTP functions ──────────────────────────────────────────────────────

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Aha! API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error("GraphQL response contained no data");
  }

  return json.data;
}

export async function restGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: AUTH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Aha! REST API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function restPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Aha! REST API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function restPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Aha! REST API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User> {
  if (cachedMe) return cachedMe;

  const data = await restGet<{ user: User }>("/api/v1/me");
  cachedMe = data.user;
  return cachedMe;
}

/**
 * Resolves a feature reference number (e.g. "DEV-123") to its opaque internal ID.
 * If the input doesn't look like a reference number (no hyphen), returns it as-is.
 */
export async function resolveFeatureId(refOrId: string): Promise<string> {
  // Reference numbers contain a hyphen (e.g. DEV-123); opaque IDs don't
  if (!refOrId.includes("-")) return refOrId;

  const data = await graphql<FeaturesResponse>(QUERY_GET_FEATURES, {
    filters: { id: [refOrId] },
    per: 1,
  });

  const feature = data.features.nodes[0];
  if (!feature) throw new Error(`Feature not found: ${refOrId}`);
  return feature.id;
}

/**
 * Resolves a release reference number (e.g. "DAI-R-3") to its opaque internal ID.
 * Validates that the release belongs to the given project by fetching the project's releases.
 * If the input doesn't look like a reference number (no hyphen), returns it as-is.
 */
export async function resolveReleaseId(releaseRef: string, projectId: string): Promise<string> {
  // If it looks like a numeric/opaque ID (no hyphen), return as-is
  if (!releaseRef.includes("-")) return releaseRef;

  // Fetch releases for the project via REST API
  const data = await restGet<{ releases: Array<{ id: string; reference_num: string; name: string }> }>(
    `/api/v1/products/${projectId}/releases`
  );

  const match = data.releases.find(
    (r) => r.reference_num.toLowerCase() === releaseRef.toLowerCase()
  );

  if (!match) {
    const available = data.releases.map((r) => `${r.reference_num} (${r.name})`).join(", ");
    throw new Error(
      `Release '${releaseRef}' not found in project '${projectId}'. Available releases: ${available}`
    );
  }

  return match.id;
}
