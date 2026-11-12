import { useQuery } from "@tanstack/react-query";
import { ClockCounterClockwise } from "phosphor-react-native";
import { useMemo } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { LogRow } from "@/src/components/log-row";
import { EmptyState, ErrorState, ScreenHeader, Skeleton } from "@/src/components/ui";
import { dayLabel } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import type { LogEntry } from "@/src/types";

export default function History() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["history"], queryFn: () => api<LogEntry[]>("/me/history?limit=100") });

  const sections = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    (data ?? []).forEach((l) => {
      const k = dayLabel(l.created_at);
      map.set(k, [...(map.get(k) ?? []), l]);
    });
    return [...map.entries()].map(([title, items]) => ({ title, data: items }));
  }, [data]);

  const granted = data?.filter((l) => l.result === "granted").length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow={data ? `${granted} granted · ${(data.length ?? 0) - granted} denied` : "Access log"} title="History" />
      {isLoading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </View>
      ) : error ? (
        <ErrorState testID="history-error" message={(error as Error).message} onRetry={refetch} />
      ) : (
        <SectionList
          testID="history-list"
          sections={sections}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <LogRow log={item} />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="history-empty" icon={<ClockCounterClockwise size={28} color={colors.muted} />} title="No access history yet" message="Every tap or QR scan at a campus door will appear here, granted or denied." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  skeletons: { padding: spacing.lg, gap: spacing.md },
  sectionHeader: { fontSize: fontSize.sm, fontWeight: "700", color: c.muted, letterSpacing: 1, textTransform: "uppercase", backgroundColor: c.surfaceSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
}));
