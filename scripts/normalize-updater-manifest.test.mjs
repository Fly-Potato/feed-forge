import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  normalizeUpdaterManifest,
  normalizeUpdaterManifestFile,
} from "./normalize-updater-manifest.mjs";

const apiUrl = "https://api.github.com/repos/Fly-Potato/feed-forge/releases/assets/123";
const downloadUrl = "https://github.com/Fly-Potato/feed-forge/releases/download/v0.1.2/Feed.Forge_0.1.2_x64-setup.exe";
const execFileAsync = promisify(execFile);

const release = {
  assets: [
    {
      apiUrl,
      contentType: "application/zip",
      createdAt: "2026-09-17T06:54:02Z",
      digest: "sha256:abc123",
      downloadCount: 0,
      id: "RA_example",
      label: "Feed Forge_0.1.2_x64-setup.exe",
      name: "Feed.Forge_0.1.2_x64-setup.exe",
      size: 3441800,
      state: "uploaded",
      updatedAt: "2026-09-17T06:54:03Z",
      url: downloadUrl,
    },
  ],
};

test("normalizes updater URLs without changing stable entries or signatures", () => {
  const manifest = {
    version: "0.1.2",
    notes: "Release notes",
    pub_date: "2026-09-17T06:54:04.065Z",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: apiUrl,
      },
      "windows-x86_64-nsis": {
        signature: "signed-nsis",
        url: downloadUrl,
      },
    },
  };

  assert.deepEqual(normalizeUpdaterManifest(manifest, release), {
    version: "0.1.2",
    notes: "Release notes",
    pub_date: "2026-09-17T06:54:04.065Z",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: downloadUrl,
      },
      "windows-x86_64-nsis": {
        signature: "signed-nsis",
        url: downloadUrl,
      },
    },
  });
});

test("rejects an updater API URL that has no matching release asset", () => {
  const manifest = {
    version: "0.1.2",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: "https://api.github.com/repos/Fly-Potato/feed-forge/releases/assets/999",
      },
    },
  };

  assert.throws(
    () => normalizeUpdaterManifest(manifest, release),
    /未找到 updater 平台 windows-x86_64 对应的 Release 资产/,
  );
});

test("writes the normalized updater manifest back to disk", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "feed-forge-updater-manifest-"));
  const manifestPath = path.join(root, "latest.json");
  const releasePath = path.join(root, "release.json");
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(manifestPath, JSON.stringify({
    version: "0.1.2",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: apiUrl,
      },
    },
  }));
  await writeFile(releasePath, JSON.stringify(release));

  await normalizeUpdaterManifestFile(manifestPath, releasePath);

  assert.deepEqual(JSON.parse(await readFile(manifestPath, "utf8")), {
    version: "0.1.2",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: downloadUrl,
      },
    },
  });
});

test("CLI normalizes the manifest used by the release workflow", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "feed-forge-updater-cli-"));
  const manifestPath = path.join(root, "latest.json");
  const releasePath = path.join(root, "release.json");
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(manifestPath, JSON.stringify({
    version: "0.1.2",
    platforms: {
      "windows-x86_64": {
        signature: "signed-primary",
        url: apiUrl,
      },
    },
  }));
  await writeFile(releasePath, JSON.stringify(release));

  await execFileAsync(process.execPath, [
    path.resolve("scripts/normalize-updater-manifest.mjs"),
    manifestPath,
    releasePath,
  ]);

  const normalized = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(normalized.platforms["windows-x86_64"].url, downloadUrl);
});
