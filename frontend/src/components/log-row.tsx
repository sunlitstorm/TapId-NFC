import { CheckCircle, XCircle } from "phosphor-react-native";
import { Text, View } from "react-native";

import { formatTime } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { LogEntry } from "@/src/types";

export function LogRow({ log, showStudent, showDate }: { log: LogEntry; showStudent?: boolean; showDate?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const granted = log.result === "granted";
  const when = showDate ? `${new Date(log.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} · ${formatTime(log.created_at)}` : formatTime(log.created_at);
  return (
    <View testID={`log-row-${log.id}`} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: granted ? colors.successSoft : colors.errorSoft }]}>
        {granted ? <CheckCircle size={22} color={colors.success} weight="fill" /> : <XCircle size={22} color={colors.error} weight="fill" />}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {showStudent ? `${log.student_name ?? "Unknown credential"}` : log.building_name ?? "Unknown building"}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {showStudent ? `${log.building_name ?? "Unknown building"} · ` : ""}
          {log.message}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.time}>{when}</Text>
        <Text style={[styles.method, { color: granted ? colors.success : colors.error }]}>{log.method.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.lg, fontWeight: "600", color: c.onSurface },
  sub: { fontSize: fontSize.sm + 1, color: c.muted },
  meta: { alignItems: "flex-end", gap: 2 },
  time: { fontSize: fontSize.sm, color: c.onSurfaceSecondary, fontWeight: "500" },
  method: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
}));
