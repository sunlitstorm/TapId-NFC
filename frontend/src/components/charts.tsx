import { Text, View } from "react-native";

import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function StackedBars({ data, testID }: { data: { label: string; granted: number; denied: number }[]; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.granted + d.denied));
  return (
    <View testID={testID}>
      <View style={styles.chart}>
        {data.map((d, i) => {
          const total = d.granted + d.denied;
          return (
            <View key={`${i}-${d.label}`} style={styles.col}>
              <Text style={styles.colValue}>{total || ""}</Text>
              <View style={styles.track}>
                <View style={{ height: `${(d.denied / max) * 100}%`, backgroundColor: colors.error, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                <View style={{ height: `${(d.granted / max) * 100}%`, backgroundColor: colors.brandPrimary, borderTopLeftRadius: d.denied ? 0 : 4, borderTopRightRadius: d.denied ? 0 : 4 }} />
              </View>
              <Text style={styles.colLabel}>{d.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.brandPrimary }]} />
          <Text style={styles.legendText}>Granted</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.error }]} />
          <Text style={styles.legendText}>Denied</Text>
        </View>
      </View>
    </View>
  );
}

export function HorizontalBars({ rows, testID }: { rows: { label: string; value: number; denied?: number }[]; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View testID={testID} style={styles.hWrap}>
      {rows.map((r) => (
        <View key={r.label} style={styles.hRow}>
          <View style={styles.hHead}>
            <Text style={styles.hLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={styles.hValue}>
              {r.value}
              {r.denied ? <Text style={{ color: colors.error }}>{`  ·  ${r.denied} denied`}</Text> : null}
            </Text>
          </View>
          <View style={styles.hTrack}>
            <View style={[styles.hFill, { width: `${(r.value / max) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chart: { flexDirection: "row", alignItems: "flex-end", height: 160, gap: spacing.sm },
  col: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 },
  colValue: { fontSize: 10, color: c.muted, fontWeight: "600" },
  track: { width: "70%", maxWidth: 28, height: 120, justifyContent: "flex-end", backgroundColor: c.surfaceSecondary, borderRadius: 4, overflow: "hidden" },
  colLabel: { fontSize: 11, color: c.muted, fontWeight: "600" },
  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: fontSize.sm, color: c.onSurfaceSecondary },
  hWrap: { gap: spacing.md },
  hRow: { gap: 6 },
  hHead: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  hLabel: { fontSize: fontSize.base, color: c.onSurface, fontWeight: "600", flexShrink: 1 },
  hValue: { fontSize: fontSize.sm, color: c.onSurfaceSecondary, fontWeight: "600" },
  hTrack: { height: 8, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  hFill: { height: 8, borderRadius: radius.pill, backgroundColor: c.brandPrimary },
}));
