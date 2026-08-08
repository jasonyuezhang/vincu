import { describe, expect, it } from "vitest";
import { resolveCliInstallSourcePath } from "./path";

describe("cli-install-path", () => {
  it("uses the bundled shim for packaged macOS installs", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "darwin",
        isPackaged: true,
        executablePath: "/Applications/Vincu.app/Contents/MacOS/Vincu",
        shimPath: "/Applications/Vincu.app/Contents/Resources/bin/vincu",
      }),
    ).toBe("/Applications/Vincu.app/Contents/Resources/bin/vincu");
  });

  it("prefers the original AppImage path on linux", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: true,
        executablePath: "/tmp/.mount_vincu123/vincu",
        shimPath: "/tmp/.mount_vincu123/resources/bin/vincu",
        appImagePath: "/home/user/Applications/Vincu.AppImage",
      }),
    ).toBe("/home/user/Applications/Vincu.AppImage");
  });

  it("falls back to the shim on windows and in development", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "win32",
        isPackaged: true,
        executablePath: "C:\\Users\\user\\AppData\\Local\\Programs\\Vincu\\Vincu.exe",
        shimPath: "C:\\Users\\user\\AppData\\Local\\Programs\\Vincu\\resources\\bin\\vincu.cmd",
      }),
    ).toBe("C:\\Users\\user\\AppData\\Local\\Programs\\Vincu\\resources\\bin\\vincu.cmd");

    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: false,
        executablePath: "/opt/Vincu/vincu",
        shimPath: "/opt/Vincu/resources/bin/vincu",
      }),
    ).toBe("/opt/Vincu/resources/bin/vincu");
  });
});
