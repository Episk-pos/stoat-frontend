/* eslint-disable no-undef */

import lnk from "lnk";
import { lstat, readlink, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const publicFolder = resolve("public");
const path = resolve("public", "assets");
const assets = resolve("scripts", "assets_fallback");

/**
 * Ensure the symlink from public/assets -> scripts/assets_fallback exists.
 */
async function createSymlink() {
  await lnk(resolve(assets), resolve(publicFolder), {
    rename: "assets",
  });
  console.info("Configured assets.");
}

try {
  await lstat(path);

  try {
    await readlink(path);
    await unlink(path);
  } catch {
    // path exists but is not a symlink; remove it
    const { rmdir } = await import("node:fs/promises");
    await rmdir(path);
  }

  createSymlink();
} catch (error) {
  if (error.code === "ENOENT") {
    createSymlink();
  } else {
    console.error(error);
    process.exit(-1);
  }
}
