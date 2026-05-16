export type ClientIdPrefix = "t" | "e" | "u" | "pref" | "pe";

export function makeClientId(prefix: ClientIdPrefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
