import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretRight, IdentificationCard, MagnifyingGlass, Users } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, Badge, ChipRow, EmptyState, ErrorState, ScreenHeader, Skeleton } from "@/src/components/ui";
import { capitalize, enrollmentTone } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Student } from "@/src/types";

type StatusFilter = "all" | "pending" | "active" | "suspended" | "graduated";
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "graduated", label: "Graduated" },
];

export default function AdminStudents() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: StatusFilter }>();
  const [status, setStatus] = useState<StatusFilter>(params.status ?? "all");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (params.status) setStatus(params.status);
  }, [params.status]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["students", status, debounced],
    queryFn: () => api<Student[]>(`/admin/students?status=${status}&q=${encodeURIComponent(debounced)}`),
  });

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow={data ? `${data.length} shown` : "Directory"} title="Students">
        <View style={styles.searchBox}>
          <MagnifyingGlass size={18} color={colors.muted} />
          <TextInput testID="student-search-input" value={q} onChangeText={setQ} placeholder="Search name, email or student no." placeholderTextColor={colors.muted} style={styles.search} autoCapitalize="none" returnKeyType="search" />
        </View>
        <ChipRow testIDPrefix="student-filter" options={FILTERS} value={status} onChange={setStatus} />
      </ScreenHeader>
      {isLoading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={68} />
          ))}
        </View>
      ) : error ? (
        <ErrorState testID="students-error" message={(error as Error).message} onRetry={refetch} />
      ) : (
        <FlatList
          testID="students-list"
          data={data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState testID="students-empty" icon={<Users size={28} color={colors.muted} />} title="No students found" message="Try a different search or filter." />}
          renderItem={({ item }) => (
            <Pressable testID={`student-row-${item.student_number}`} onPress={() => router.push(`/admin-student/${item.id}`)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Avatar path={item.photo_url} name={item.full_name} size={44} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.full_name}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>{`${item.student_number} · ${item.program}`}</Text>
              </View>
              <View style={styles.meta}>
                <Badge label={capitalize(item.enrollment_status)} tone={enrollmentTone(item.enrollment_status)} />
                {item.has_active_credential ? (
                  <View style={styles.idPill}>
                    <IdentificationCard size={12} color={colors.success} weight="fill" />
                    <Text style={styles.idText}>ID issued</Text>
                  </View>
                ) : null}
              </View>
              <CaretRight size={16} color={colors.muted} />
            </Pressable>
          )}
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider, minHeight: 72 },
  rowPressed: { backgroundColor: c.surfaceSecondary },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg, fontWeight: "600", color: c.onSurface },
  sub: { fontSize: fontSize.sm + 1, color: c.muted },
  meta: { alignItems: "flex-end", gap: 4 },
  idPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  idText: { fontSize: 11, color: c.success, fontWeight: "700" },
}));
