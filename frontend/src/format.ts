import type { EnrollmentStatus } from "@/src/types";

export type Tone = "success" | "warning" | "error" | "info" | "neutral";

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

export const enrollmentTone = (s: EnrollmentStatus): Tone =>
  ({ active: "success", pending: "warning", suspended: "error", graduated: "info" } as const)[s];

export const REVOKE_REASONS: Record<string, string> = {
  lost_device: "Lost device",
  stolen_device: "Stolen device",
  admin_revoked: "Revoked by administrator",
  other: "Other",
};

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
