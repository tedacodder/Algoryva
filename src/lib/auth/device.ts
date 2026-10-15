/**
 * A short label such as "Chrome on Windows", taken from the User-Agent header. It is the only device detail we store, so
 * a sign-in can be recognised without keeping IP addresses.
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

/**
 * "first": the account has no earlier sign-ins, so no alert is sent.
 * "known": this device has signed in before.
 * "new": other devices have signed in, but this one has not. This is the case that triggers an alert.
 */
export type DeviceStatus = "first" | "known" | "new";
export function classifyDevice(previousDevices: string[], device: string): DeviceStatus {
  if (previousDevices.length === 0) return "first";
  return previousDevices.includes(device) ? "known" : "new";
}
