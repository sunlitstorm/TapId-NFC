import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Buildings as BuildingsIcon, CaretLeft, Plus } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState, ErrorState, Field, Skeleton } from "@/src/components/ui";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Building } from "@/src/types";

export default function BuildingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["buildings"], queryFn: () => api<Building[]>("/admin/buildings") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.name.trim().length < 2) return setFormError("Name must be at least 2 characters");
    if (!/^[A-Za-z0-9-]{2,10}$/.test(form.code.trim())) return setFormError("Code must be 2-10 letters, numbers or dashes");
    setSaving(true);
    setFormError(null);
    try {
      await api("/admin/buildings", { method: "POST", body: { ...form, code: form.code.trim() } });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      setOpen(false);
      setForm({ name: "", code: "", description: "" });
      toast("Building added", "success");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="buildings-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} style={styles.iconBtn}>
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Buildings</Text>
        <Pressable testID="add-building-button" onPress={() => setOpen(true)} style={[styles.iconBtn, styles.addBtn]}>
          <Plus size={20} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
      </View>
      {isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={200} />
        </View>
      ) : error ? (
        <ErrorState testID="buildings-error" message={(error as Error).message} onRetry={refetch} />
      ) : (
        <FlatList
          testID="buildings-list"
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          ListEmptyComponent={<EmptyState testID="buildings-empty" icon={<BuildingsIcon size={28} color={colors.muted} />} title="No buildings yet" message="Add the first building that has a campus reader." />}
          renderItem={({ item }) => (
            <View testID={`building-row-${item.code}`} style={styles.row}>
              <View style={styles.code}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.description || "No description"}
                </Text>
              </View>
              <View style={styles.count}>
                <Text style={styles.countValue}>{item.permitted_students ?? 0}</Text>
                <Text style={styles.countLabel}>students</Text>
              </View>
            </View>
          )}
        />
      )}
      <Sheet testID="add-building-sheet" visible={open} onClose={() => setOpen(false)} title="Add building">
        <View style={styles.form}>
          <Field testID="building-name-input" label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Student Union" />
          <Field testID="building-code-input" label="Code" value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v }))} placeholder="SU" autoCapitalize="characters" />
          <Field testID="building-description-input" label="Description" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Optional" />
          {formError ? (
            <Text testID="building-form-error" style={styles.error}>
              {formError}
            </Text>
          ) : null}
          <Button testID="save-building-button" title="Add building" loading={saving} onPress={save} />
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: c.brandPrimary },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 720, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  code: { width: 52, height: 40, borderRadius: radius.sm, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  codeText: { fontWeight: "800", color: c.onBrandSecondary, fontSize: fontSize.sm, letterSpacing: 0.5 },
  flex: { flex: 1 },
  name: { fontSize: fontSize.base + 1, fontWeight: "700", color: c.onSurface },
  sub: { fontSize: fontSize.sm, color: c.muted, marginTop: 2 },
  count: { alignItems: "flex-end" },
  countValue: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  countLabel: { fontSize: 10, color: c.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  form: { gap: spacing.lg },
  error: { color: c.error, fontSize: fontSize.base, fontWeight: "600" },
}));
