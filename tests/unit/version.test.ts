import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { APP_VERSION, versionLabel } from "../../src/version";

describe("version", () => {
  it("matches package.json, so there is one place to change it", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("labels the build for testers", () => {
    expect(versionLabel("1.2.3")).toBe("Beta 1.2.3");
  });
});
