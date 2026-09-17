import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function isGitHubReleaseAssetApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  return url.protocol === "https:"
    && url.hostname === "api.github.com"
    && segments.length === 6
    && segments[0] === "repos"
    && segments[3] === "releases"
    && segments[4] === "assets"
    && /^[0-9]+$/.test(segments[5]);
}

export function normalizeUpdaterManifest(manifest, release) {
  const downloadUrls = new Map(release.assets.map((asset) => [asset.apiUrl, asset.url]));
  const platforms = Object.fromEntries(
    Object.entries(manifest.platforms).map(([platform, entry]) => {
      const downloadUrl = downloadUrls.get(entry.url);
      if (!downloadUrl && isGitHubReleaseAssetApiUrl(entry.url)) {
        throw new Error("未找到 updater 平台 " + platform + " 对应的 Release 资产。");
      }
      return [
        platform,
        {
          ...entry,
          url: downloadUrl ?? entry.url,
        },
      ];
    }),
  );

  return {
    ...manifest,
    platforms,
  };
}

export async function normalizeUpdaterManifestFile(manifestPath, releasePath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  const normalized = normalizeUpdaterManifest(manifest, release);
  await writeFile(manifestPath, JSON.stringify(normalized, null, 2) + "\n");
  return normalized;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entry === import.meta.url) {
  const [manifestPath, releasePath] = process.argv.slice(2);
  normalizeUpdaterManifestFile(manifestPath, releasePath)
    .then(() => console.log("Updater manifest download URLs normalized."))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
