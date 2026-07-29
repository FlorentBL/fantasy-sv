export type DatapackMode = "default" | "community";

export function normalizeDatapackMode(value: unknown): DatapackMode {
  return value === "default" ? "default" : "community";
}

export function parseDatapackMode(value: unknown): DatapackMode {
  if (value === "default" || value === "community") return value;
  throw new Error("La source doit être le pack Soccerverse ou le pack communautaire.");
}
