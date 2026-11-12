import { useQuery } from "@tanstack/react-query";
import { ListBullets, MagnifyingGlass } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { LogRow } from "@/src/components/log-row";
import { ChipRow, EmptyState, ErrorState, ScreenHeader, Skeleton } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Building, LogEntry } from "@/src/types";

type ResultFilter = "all" | "granted" | "denied";

export default function AdminLogs() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [result, setResult] = useState<ResultFilter>("all");
  const [building, setBuilding] = useState<string>("all");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildings = useQuery({ queryKey: ["buildings"], queryFn: () => api<Building[]>("/admin/buildings") });
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["logs", result, building, debounced],
    queryFn: () => api<LogEntry[]>(`/admin/logs?result=${result}&building_id=${building === "all" ? "" : building}&q=${encodeURIComponent(debounced)}&limit=200`),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow={data ? `${data.length} attempts` : "Audit trail"} title="Access logs">
        <View style={styles.searchBox}>
          <MagnifyingGlass size={18} color={colors.muted} />
          <TextInput testID="logs-search-input" value={q} onChangeText={setQ} placeholder="Search student, building or reason" placeholderTextColor={colors.muted} style={styles.search} autoCapitalize="none" />
        </View>
        <ChipRow
          testIDPrefix="logs-result"
          value={result}
          onChange={setResult}
          options={[
            { key: "all", label: "All results" },
            { key: "granted", label: "Granted" },
            { key: "denied", label: "Denied" },
          ]}
        />
        <ChipRow testIDPrefix="logs-building" value={building} onChange={setBuilding} options={[{ key: "all", label: "All buildings" }, ...(buildings.data ?? []).map((b) => ({ key: b.id, label: b.code }))]} />
      </ScreenHeader>
      {isLoading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </View>
      ) : error ? (
        <ErrorState testID="logs-error" message={(error as Error).message} onRetry={refetch} />
      ) : (
        <FlatList
          testID="logs-list"
          data={data}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <LogRow log={item} showStudent showDate />}
          contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="logs-empty" icon={<ListBullets size={28} color={colors.muted} />} title="No matching attempts" message="Adjust the filters or simulate a tap from the Reader tab." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  search: { flex: 1, fontSize: fontSize.base + 1, color: c.onSurface, height: 44 },
  skeletons: { padding: spacing.lg, gap: spacing.md },
}));
