import { describe, expect, it } from "vitest";
import { classifyDevice, describeDevice } from "./device";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("describeDevice", () => {
  it("names the browser and the system", () => {
    expect(describeDevice(CHROME_WIN)).toBe("Chrome on Windows");
    expect(describeDevice(SAFARI_IPHONE)).toBe("Safari on iOS");
  });
  it("does not mistake Edge or Android Chrome for other browsers", () => {
    expect(describeDevice(EDGE_WIN)).toBe("Edge on Windows");
    expect(describeDevice(CHROME_ANDROID)).toBe("Chrome on Android");
  });
  it("handles a missing header", () => {
    expect(describeDevice(null)).toBe("Unknown device");
    expect(describeDevice("")).toBe("Unknown device");
  });
});

describe("classifyDevice", () => {
  it("treats the first sign-in on an account as first, so no alert is sent", () => {
    expect(classifyDevice([], "Chrome on Windows")).toBe("first");
  });
  it("recognises a device the account has used before", () => {
    expect(classifyDevice(["Chrome on Windows", "Safari on iOS"], "Safari on iOS")).toBe("known");
  });
  it("flags a device the account has never used, once other devices exist", () => {
    expect(classifyDevice(["Chrome on Windows"], "Firefox on Linux")).toBe("new");
  });
});
