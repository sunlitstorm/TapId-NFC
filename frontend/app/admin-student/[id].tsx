import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CaretLeft, IdentificationCard, ShieldSlash } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { LogRow } from "@/src/components/log-row";
import { useToast } from "@/src/components/toast";
import { Avatar, Badge, Button, Card, ChipRow, ErrorState, SectionTitle, Skeleton } from "@/src/components/ui";
import { capitalize, enrollmentTone, formatDateTime, REVOKE_REASONS } from "@/src/format";
import { haptic } from "@/src/haptics";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Building, EnrollmentStatus, StudentDetail } from "@/src/types";

export default function AdminStudentDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery({ queryKey: ["student", id], queryFn: () => api<StudentDetail>(`/admin/students/${id}`) });
  const buildings = useQuery({ queryKey: ["buildings"], queryFn: () => api<Building[]>("/admin/buildings") });
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (detail.data) setPerms(new Set(detail.data.permitted_building_ids));
  }, [detail.data]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["student", id] });
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
    qc.invalidateQueries({ queryKey: ["active-credentials"] });
    qc.invalidateQueries({ queryKey: ["buildings"] });
  };

  const act = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      refreshAll();
      toast(success, "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const s = detail.data?.student;
  const active = detail.data?.credentials.find((c) => c.status === "active");
  const permsChanged = detail.data && (perms.size !== detail.data.permitted_building_ids.length || detail.data.permitted_building_ids.some((b) => !perms.has(b)));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="student-detail-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/students"))} style={styles.back}>
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Student</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {detail.isLoading ? (
          <Skeleton height={200} />
        ) : detail.error ? (
          <ErrorState testID="student-detail-error" message={(detail.error as Error).message} onRetry={detail.refetch} />
        ) : s ? (
          <>
            <Card style={styles.hero}>
              <Avatar path={s.photo_url} name={s.full_name} size={64} />
              <View style={styles.flex}>
                <Text testID="student-detail-name" style={styles.name}>
                  {s.full_name}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>{s.email}</Text>
                <Text style={styles.sub}>{`${s.student_number} · ${s.program}`}</Text>
              </View>
              <Badge testID="student-detail-status" label={capitalize(s.enrollment_status)} tone={enrollmentTone(s.enrollment_status)} />
            </Card>

            <SectionTitle>Enrollment status</SectionTitle>
            <View style={styles.bleed}>
              <ChipRow<EnrollmentStatus>
                testIDPrefix="enrollment-status"
                value={s.enrollment_status}
                onChange={(v) => v !== s.enrollment_status && act(`status`, () => api(`/admin/students/${id}`, { method: "PATCH", body: { enrollment_status: v } }), `Enrollment set to ${v}`)}
                options={[
                  { key: "pending", label: "Pending" },
                  { key: "active", label: "Active" },
                  { key: "suspended", label: "Suspended" },
                  { key: "graduated", label: "Graduated" },
                ]}
              />
            </View>

            <SectionTitle>Digital ID</SectionTitle>
            <Card testID="student-credential-card" style={styles.gapSm}>
              {active ? (
                <>
                  <View style={styles.credHead}>
                    <IdentificationCard size={26} color={colors.success} weight="duotone" />
                    <View style={styles.flex}>
                      <Text testID="student-credential-uid" style={styles.credUid}>
                        {active.credential_uid}
                      </Text>
                      <Text style={styles.sub}>{`Issued ${formatDateTime(active.issued_at)}`}</Text>
                    </View>
                    <Badge label="Active" tone="success" />
                  </View>
                  <Button
                    testID="revoke-credential-button"
                    variant="danger"
                    title={confirmRevoke ? "Tap again to confirm revoke" : "Revoke digital ID"}
                    loading={busy === "revoke"}
                    icon={<ShieldSlash size={20} color={colors.onError} weight="bold" />}
                    onPress={() => {
                      if (!confirmRevoke) return setConfirmRevoke(true);
                      setConfirmRevoke(false);
                      haptic.heavy();
                      act("revoke", () => api(`/admin/students/${id}/credential/revoke`, { method: "POST" }), "Digital ID revoked");
                    }}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.sub}>{s.enrollment_status === "active" ? "No active credential. Issue a new digital ID to this student's device." : "Set enrollment to Active before issuing a digital ID."}</Text>
                  <Button testID="issue-credential-button" title="Issue digital ID" disabled={s.enrollment_status !== "active"} loading={busy === "issue"} onPress={() => act("issue", () => api(`/admin/students/${id}/credential`, { method: "POST", body: {} }), "Digital ID issued")} />
                </>
              )}
              {detail.data!.credentials.filter((c) => c.status === "revoked").slice(0, 3).map((c) => (
                <Text key={c.id} style={styles.history}>{`${c.credential_uid} · revoked ${c.revoked_at ? formatDateTime(c.revoked_at) : ""} · ${REVOKE_REASONS[c.revoke_reason ?? "other"] ?? c.revoke_reason}`}</Text>
              ))}
            </Card>

            <SectionTitle right={<Text style={styles.sub}>{`${perms.size} of ${buildings.data?.length ?? 0}`}</Text>}>Building access</SectionTitle>
            <Card style={styles.permCard}>
              {(buildings.data ?? []).map((b, i, arr) => (
                <View key={b.id} style={[styles.permRow, i === arr.length - 1 && styles.permLast]}>
                  <View style={styles.flex}>
                    <Text style={styles.permName}>{b.name}</Text>
                    <Text style={styles.sub}>{b.code}</Text>
                  </View>
                  <Switch
                    testID={`permission-switch-${b.code}`}
                    value={perms.has(b.id)}
                    onValueChange={(on) =>
                      setPerms((prev) => {
                        const next = new Set(prev);
                        on ? next.add(b.id) : next.delete(b.id);
                        return next;
                      })
                    }
                    trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
                    thumbColor={colors.surface}
                  />
                </View>
              ))}
            </Card>
            <Button testID="save-permissions-button" title="Save access permissions" disabled={!permsChanged} loading={busy === "perms"} onPress={() => act("perms", () => api(`/admin/students/${id}/permissions`, { method: "PUT", body: { building_ids: [...perms] } }), "Permissions saved")} style={styles.mt} />

            <SectionTitle>Recent activity</SectionTitle>
            <View style={styles.logBox}>{detail.data!.recent_logs.length ? detail.data!.recent_logs.map((l) => <LogRow key={l.id} log={l} showDate />) : <Text style={[styles.sub, styles.pad]}>No verification attempts yet.</Text>}</View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface },
  content: { padding: spacing.lg, maxWidth: 720, width: "100%", alignSelf: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  name: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  sub: { fontSize: fontSize.sm + 1, color: c.muted, lineHeight: 18 },
  bleed: { marginHorizontal: -spacing.lg },
  gapSm: { gap: spacing.md },
  credHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  credUid: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface, letterSpacing: 0.5 },
  history: { fontSize: fontSize.sm, color: c.muted },
  permCard: { paddingVertical: 0 },
  permRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider, minHeight: 60 },
  permLast: { borderBottomWidth: 0 },
  permName: { fontSize: fontSize.base + 1, fontWeight: "600", color: c.onSurface },
  mt: { marginTop: spacing.md },
  logBox: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  pad: { padding: spacing.lg },
}));
