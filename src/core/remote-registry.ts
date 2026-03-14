export interface RemoteRegistryManifest {
  version: "1";
  name: string;
  description?: string;
  skills: RemoteRegistrySkill[];
}

export interface RemoteRegistrySkill {
  name: string;
  description: string;
  source: string;
  version: string;
  tags?: string[];
  author?: string;
}

/**
 * Fetch and parse a remote registry manifest from a URL.
 */
export async function fetchRegistry(
  url: string
): Promise<RemoteRegistryManifest> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not fetch registry at ${url} — check the URL and your network connection.`);
  }

  if (!response.ok) {
    throw new Error(
      `Registry at ${url} returned HTTP ${response.status}.`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Registry at ${url} returned invalid JSON.`);
  }

  const manifest = data as Record<string, unknown>;

  if (manifest.version !== "1") {
    throw new Error(
      `Unsupported registry version "${manifest.version}" — expected "1".`
    );
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    throw new Error(`Registry at ${url} is missing a "name" field.`);
  }

  if (!Array.isArray(manifest.skills)) {
    throw new Error(`Registry at ${url} is missing a "skills" array.`);
  }

  return data as RemoteRegistryManifest;
}
