export type UserRole = "ADMIN" | "AGENT" | "INSPECTEUR";

export function canApplyExoneration(role?: UserRole | null) {
  return role === "ADMIN" || role === "INSPECTEUR";
}
