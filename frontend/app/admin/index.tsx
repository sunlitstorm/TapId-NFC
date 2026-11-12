import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Buildings, CaretRight, HourglassMedium, SignOut } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { HorizontalBars, StackedBars } from "@/src/components/charts";
import { LogRow } from "@/src/components/log-row";
import { Card, ErrorState, ScreenHeader, SectionTitle, Skeleton } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Analytics } from "@/src/types";

export default function AdminOverview() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { logout } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["analytics"], queryFn: () => api<Analytics>("/admin/analytics"), refetchInterval: 30000 });

  const metrics = data
    ? [
        { key: "students", label: "Students", value: data.totals.students, tone: colors.brandPrimary },
        { key: "active-ids", label: "Active IDs", value: data.totals.active_credentials, tone: colors.info },
        { key: "granted-today", label: "Granted today", value: data.totals.granted_today, tone: colors.success },
        { key: "denied-today", label: "Denied today", value: data.totals.denied_today, tone: colors.error },
      ]
    : [];

  return (
    <View style={styles.root}>
      <ScreenHeader
        topInset={insets.top}
        eyebrow="Campus security"
        title="Overview"
        right={
          <View style={styles.headerActions}>
            <Pressable testID="open-buildings-button" onPress={() => router.push("/buildings")} style={styles.iconBtn}>
              <Buildings size={22} color={colors.brandPrimary} weight="duotone" />
            </Pressable>
            <Pressable
              testID="admin-sign-out-button"
              onPress={async () => {
                await logout();
                router.replace("/login");
              }}
              style={styles.iconBtn}
            >
              <SignOut size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}>
        {isLoading ? (
          <View style={styles.gap}>
            <Skeleton height={180} />
            <Skeleton height={220} />
          </View>
        ) : error ? (
          <ErrorState testID="analytics-error" message={(error as Error).message} onRetry={refetch} />
        ) : data ? (
          <>
            {data.totals.students_by_status.pending > 0 ? (
              <Pressable testID="pending-approvals-banner" onPress={() => router.push({ pathname: "/admin/students", params: { status: "pending" } })} style={styles.banner}>
                <HourglassMedium size={22} color={colors.warning} weight="fill" />
                <Text style={styles.bannerText}>{`${data.totals.students_by_status.pending} student${data.totals.students_by_status.pending > 1 ? "s" : ""} awaiting enrollment approval`}</Text>
                <CaretRight size={18} color={colors.warning} weight="bold" />
              </Pressable>
            ) : null}

            <View style={styles.grid}>
              {metrics.map((m, i) => (
                <Animated.View key={m.key} entering={FadeInDown.delay(i * 60).duration(400)} style={styles.metric} testID={`metric-${m.key}`}>
                  <View style={[styles.metricBar, { backgroundColor: m.tone }]} />
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </Animated.View>
              ))}
            </View>

            <SectionTitle right={<Text style={styles.sectionMeta}>{`${data.totals.attempts_7d} attempts`}</Text>}>Last 7 days</SectionTitle>
            <Card>
              <StackedBars testID="daily-chart" data={data.daily.map((d) => ({ label: new Date(d.date + "T12:00:00Z").toLocaleDateString([], { weekday: "narrow" }), granted: d.granted, denied: d.denied }))} />
            </Card>

            <SectionTitle>Building traffic</SectionTitle>
            <Card>
              {data.by_building.length ? (
                <HorizontalBars testID="building-chart" rows={data.by_building.map((b) => ({ label: b.building, value: b.granted + b.denied, denied: b.denied }))} />
              ) : (
                <Text style={styles.muted}>No verification attempts in the last 7 days.</Text>
              )}
            </Card>

            <SectionTitle>Denial reasons</SectionTitle>
            <Card testID="denial-reasons-card" style={styles.reasons}>
              {data.denial_reasons.length ? (
                data.denial_reasons.map((r) => (
                  <View key={r.reason} style={styles.reasonRow}>
                    <Text style={styles.reasonText} numberOfLines={1}>
                      {r.message}
                    </Text>
                    <View style={styles.reasonCount}>
                      <Text style={styles.reasonCountText}>{r.count}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.muted}>No denied attempts this week.</Text>
              )}
            </Card>

            <SectionTitle>Recent denied attempts</SectionTitle>
            <View style={styles.logBox}>
              {data.recent_denied.length ? data.recent_denied.map((l) => <LogRow key={l.id} log={l} showStudent showDate />) : <Text style={[styles.muted, styles.pad]}>Nothing suspicious - all clear.</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, maxWidth: 900, width: "100%", alignSelf: "center" },
  gap: { gap: spacing.lg },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.warningSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, minHeight: 52 },
  bannerText: { flex: 1, color: c.warning, fontWeight: "700", fontSize: fontSize.base },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, overflow: "hidden" },
  metricBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  metricValue: { fontSize: 32, fontWeight: "800", color: c.onSurface, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  metricLabel: { fontSize: fontSize.sm + 1, color: c.muted, fontWeight: "600", marginTop: 2 },
  sectionMeta: { fontSize: fontSize.sm, color: c.muted },
  muted: { color: c.muted, fontSize: fontSize.base },
  pad: { padding: spacing.lg },
  reasons: { gap: spacing.md },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reasonText: { flex: 1, fontSize: fontSize.base, color: c.onSurface },
  reasonCount: { minWidth: 32, height: 24, borderRadius: radius.pill, backgroundColor: c.errorSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  reasonCountText: { color: c.error, fontWeight: "800", fontSize: fontSize.sm },
  logBox: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
}));
