export type Preference = "system" | "light" | "dark";

/** The mode a preference resolves to, given what the phone reports. */
export function resolveMode(preference: Preference, systemScheme: "light" | "dark" | null | undefined): "light" | "dark" {
  if (preference === "system") return systemScheme === "dark" ? "dark" : "light";
  return preference;
}
