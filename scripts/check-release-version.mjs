import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SEMVER_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function readJsonVersion(filePath) {
  const value = JSON.parse(await readFile(filePath, "utf8"));
  if (typeof value.version !== "string") throw new Error(`${filePath} 缺少字符串 version`);
  return value.version;
}

async function readCargoVersion(filePath) {
  const contents = await readFile(filePath, "utf8");
  const packageHeading = contents.search(/^\[package\]\s*$/m);
  const packageBodyStart = packageHeading < 0 ? -1 : contents.indexOf("\n", packageHeading) + 1;
  const remainder = packageBodyStart > 0 ? contents.slice(packageBodyStart) : "";
  const nextSection = remainder.search(/^\[[^\]]+\]\s*$/m);
  const packageSection = nextSection < 0 ? remainder : remainder.slice(0, nextSection);
  const version = packageSection.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!version) throw new Error(`${filePath} 的 [package] 缺少 version`);
  return version;
}

export async function validateReleaseVersion(root, tag) {
  const match = tag?.match(SEMVER_TAG);
  if (!match) throw new Error("发布标签必须使用 vX.Y.Z 格式并符合 SemVer。");
  const expected = tag.slice(1);
  const versions = [
    ["package.json", await readJsonVersion(path.join(root, "package.json"))],
    ["src-tauri/Cargo.toml", await readCargoVersion(path.join(root, "src-tauri", "Cargo.toml"))],
    ["src-tauri/tauri.conf.json", await readJsonVersion(path.join(root, "src-tauri", "tauri.conf.json"))],
  ];
  const mismatches = versions.filter(([, version]) => version !== expected);
  if (mismatches.length > 0) {
    throw new Error([
      `发布标签 ${tag} 与以下版本不一致：`,
      ...mismatches.map(([file, version]) => `- ${file}: ${version}`),
    ].join("\n"));
  }
  return expected;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entry === import.meta.url) {
  const tag = process.argv.slice(2).find((argument) => argument !== "--");
  validateReleaseVersion(process.cwd(), tag)
    .then((version) => console.log(`Release version ${version} verified.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
