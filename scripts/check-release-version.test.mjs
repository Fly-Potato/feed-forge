import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { validateReleaseVersion } from "./check-release-version.mjs";

async function fixture({ packageVersion = "0.1.0", cargoVersion = "0.1.0", tauriVersion = "0.1.0" } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "feed-forge-release-version-"));
  await mkdir(path.join(root, "src-tauri"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: packageVersion }));
  await writeFile(path.join(root, "src-tauri", "Cargo.toml"), `[package]\nname = "feed-forge"\nversion = "${cargoVersion}"\n`);
  await writeFile(path.join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ version: tauriVersion }));
  return root;
}

test("accepts a SemVer tag when all release versions match", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  assert.equal(await validateReleaseVersion(root, "v0.1.0"), "0.1.0");
});

test("rejects a release tag without the v prefix", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(() => validateReleaseVersion(root, "0.1.0"), /必须使用 vX\.Y\.Z/);
});

test("rejects invalid semantic versions", async (context) => {
  const root = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(() => validateReleaseVersion(root, "v01.1.0"), /必须使用 vX\.Y\.Z/);
});

test("reports every manifest whose version differs from the tag", async (context) => {
  const root = await fixture({ packageVersion: "0.1.1", cargoVersion: "0.2.0" });
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    () => validateReleaseVersion(root, "v0.1.0"),
    (error) => {
      assert.match(error.message, /package\.json: 0\.1\.1/);
      assert.match(error.message, /src-tauri\/Cargo\.toml: 0\.2\.0/);
      assert.doesNotMatch(error.message, /tauri\.conf\.json: 0\.1\.0/);
      return true;
    },
  );
});
