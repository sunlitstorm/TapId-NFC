import { useQuery } from "@tanstack/react-query";
import { CheckCircle, ContactlessPayment, HourglassMedium, Info, LockKey, QrCode, ShieldWarning } from "phosphor-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { DigitalIdCard } from "@/src/components/digital-id-card";
import { QrSheet } from "@/src/components/qr-sheet";
import { TapSheet } from "@/src/components/tap-sheet";
import { Button, Card, ErrorState, ScreenHeader, SectionTitle, Skeleton } from "@/src/components/ui";
import { REVOKE_REASONS } from "@/src/format";
import { haptic } from "@/src/haptics";
import { usesNativeTabs } from "@/src/navigation";
import { activeTransport } from "@/src/nfc/transport";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { MeResponse } from "@/src/types";

export default function StudentId() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [tapOpen, setTapOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me") });

  const student = data?.student;
  const credential = data?.credential;
  const canTap = student?.enrollment_status === "active" && credential?.status === "active";

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow="TapID Wallet" title="Digital ID" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}
      >
        {isLoading ? (
          <Skeleton height={300} />
        ) : error ? (
          <ErrorState testID="id-error" message={(error as Error).message} onRetry={refetch} />
        ) : student ? (
          <>
            <Animated.View entering={FadeInDown.duration(450)}>
              <DigitalIdCard student={student} credential={credential ?? null} />
            </Animated.View>

            {canTap ? (
              <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.actions}>
                <Button testID="tap-to-enter-button" size="lg" title="Tap to enter" icon={<ContactlessPayment size={22} color={colors.onBrandPrimary} weight="bold" />} onPress={() => setTapOpen(true)} />
                <Button
                  testID="show-qr-button"
                  variant="secondary"
                  title="Show QR code"
                  icon={<QrCode size={20} color={colors.onBrandSecondary} weight="bold" />}
                  onPress={() => {
                    haptic.selection();
                    setQrOpen(true);
                  }}
                />
              </Animated.View>
            ) : (
              <Card testID="id-status-card" style={styles.statusCard}>
                {student.enrollment_status !== "active" ? (
                  <>
                    <HourglassMedium size={28} color={colors.warning} weight="duotone" />
                    <Text style={styles.statusTitle}>{student.enrollment_status === "pending" ? "Awaiting enrollment verification" : `Enrollment ${student.enrollment_status}`}</Text>
                    <Text style={styles.statusText}>The campus ID office must confirm your enrollment before a digital ID can be used. Pull down to refresh.</Text>
                  </>
                ) : credential?.status === "revoked" ? (
                  <>
                    <ShieldWarning size={28} color={colors.error} weight="duotone" />
                    <Text style={styles.statusTitle}>Credential revoked</Text>
                    <Text style={styles.statusText}>{`Reason: ${REVOKE_REASONS[credential.revoke_reason ?? "other"] ?? credential.revoke_reason}. Visit the campus ID office to get a new digital ID issued.`}</Text>
                  </>
                ) : (
                  <>
                    <HourglassMedium size={28} color={colors.info} weight="duotone" />
                    <Text style={styles.statusTitle}>Digital ID being prepared</Text>
                    <Text style={styles.statusText}>You are enrolled. An administrator will issue your NFC credential shortly.</Text>
                  </>
                )}
              </Card>
            )}

            <View style={styles.notice} testID="nfc-simulation-notice">
              <Info size={18} color={colors.info} weight="fill" />
              <Text style={styles.noticeText}>
                {activeTransport.isHardware ? "Hardware NFC enabled." : "NFC is simulated in this version. Taps send a signed, single-use token to the verification API - no NFC hardware is used."}
              </Text>
            </View>

            <SectionTitle>Building access</SectionTitle>
            <View style={styles.buildingList}>
              {data?.buildings.map((b) => (
                <View key={b.id} testID={`access-building-${b.code}`} style={styles.buildingRow}>
                  <View style={[styles.codeBox, { backgroundColor: b.permitted ? colors.brandSecondary : colors.surfaceTertiary }]}>
                    <Text style={[styles.code, { color: b.permitted ? colors.onBrandSecondary : colors.muted }]}>{b.code}</Text>
                  </View>
                  <Text style={styles.buildingName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  {b.permitted ? <CheckCircle size={20} color={colors.success} weight="fill" /> : <LockKey size={18} color={colors.muted} />}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      <TapSheet visible={tapOpen} onClose={() => setTapOpen(false)} buildings={data?.buildings ?? []} />
      <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  statusCard: { marginTop: spacing.xl, gap: spacing.sm },
  statusTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface },
  statusText: { fontSize: fontSize.base, color: c.onSurfaceSecondary, lineHeight: 20 },
  notice: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.infoSoft, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: fontSize.sm + 1, color: c.onSurfaceSecondary, lineHeight: 18 },
  buildingList: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  buildingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  codeBox: { width: 44, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  code: { fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 0.5 },
  buildingName: { flex: 1, fontSize: fontSize.base + 1, fontWeight: "600", color: c.onSurface },
}));
