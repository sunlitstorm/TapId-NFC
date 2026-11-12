import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera, DeviceMobile, ShieldWarning, SignOut } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadPhoto } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { Avatar, Badge, Button, Card, ChipRow, ErrorState, ScreenHeader, SectionTitle, Skeleton } from "@/src/components/ui";
import { capitalize, enrollmentTone, formatDateTime, REVOKE_REASONS } from "@/src/format";
import { haptic } from "@/src/haptics";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { MeResponse } from "@/src/types";

type PermissionPrompt = null | "explain" | "blocked";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me") });
  const [uploading, setUploading] = useState(false);
  const [permPrompt, setPermPrompt] = useState<PermissionPrompt>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState<"lost_device" | "stolen_device">("lost_device");
  const [revoking, setRevoking] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setUploading(true);
    try {
      await uploadPhoto({ uri: a.uri, name: a.fileName ?? "photo.jpg", mimeType: a.mimeType ?? "image/jpeg" });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast("ID photo updated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const startPhoto = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return pick();
    setPermPrompt(current.canAskAgain ? "explain" : "blocked");
  };

  const requestPermission = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.granted) {
      setPermPrompt(null);
      pick();
    } else setPermPrompt(res.canAskAgain ? "explain" : "blocked");
  };

  const revoke = async () => {
    haptic.heavy();
    setRevoking(true);
    try {
      await api("/me/credential/revoke", { method: "POST", body: { reason } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      setRevokeOpen(false);
      toast("Credential revoked on all readers", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setRevoking(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  const s = data?.student;
  const cred = data?.credential;

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow="Account" title="Profile" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.brandPrimary} />}>
        {isLoading ? (
          <Skeleton height={180} />
        ) : error ? (
          <ErrorState testID="profile-error" message={(error as Error).message} onRetry={refetch} />
        ) : s ? (
          <>
            <Card style={styles.hero}>
              <Pressable testID="change-photo-button" onPress={startPhoto} style={styles.avatarWrap} disabled={uploading}>
                <Avatar testID="profile-avatar" path={s.photo_url} name={s.full_name} size={88} />
                <View style={styles.cameraBadge}>{uploading ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Camera size={16} color={colors.onBrandPrimary} weight="bold" />}</View>
              </Pressable>
              <Text testID="profile-name" style={styles.name}>
                {s.full_name}
              </Text>
              <Text style={styles.email}>{s.email}</Text>
              <Badge testID="profile-enrollment-badge" label={capitalize(s.enrollment_status)} tone={enrollmentTone(s.enrollment_status)} />
            </Card>

            <SectionTitle>Student record</SectionTitle>
            <Card style={styles.list}>
              <Row label="Student number" value={s.student_number} />
              <Row label="Program" value={s.program} />
              <Row label="Enrollment status" value={capitalize(s.enrollment_status)} />
              <Row label="Member since" value={new Date(s.created_at).toLocaleDateString()} last />
            </Card>

            <SectionTitle>NFC credential</SectionTitle>
            <Card testID="credential-card" style={styles.credCard}>
              {cred ? (
                <>
                  <View style={styles.credHead}>
                    <View style={styles.credIcon}>
                      <DeviceMobile size={22} color={colors.brandPrimary} weight="duotone" />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.credUid}>{cred.credential_uid}</Text>
                      <Text style={styles.credSub}>{cred.device_label}</Text>
                    </View>
                    <Badge testID="credential-status-badge" label={capitalize(cred.status)} tone={cred.status === "active" ? "success" : "error"} />
                  </View>
                  <Text style={styles.credMeta}>{`Issued ${formatDateTime(cred.issued_at)}`}</Text>
                  {cred.revoked_at ? <Text style={styles.credMeta}>{`Revoked ${formatDateTime(cred.revoked_at)} · ${REVOKE_REASONS[cred.revoke_reason ?? "other"] ?? cred.revoke_reason}`}</Text> : null}
                  {cred.status === "active" ? (
                    <Button testID="report-lost-device-button" variant="danger" title="Report lost device" icon={<ShieldWarning size={20} color={colors.onError} weight="bold" />} onPress={() => setRevokeOpen(true)} style={styles.mt} />
                  ) : null}
                </>
              ) : (
                <Text style={styles.credSub}>No credential issued yet. It will appear here once the campus ID office activates your digital ID.</Text>
              )}
            </Card>

            <Button testID="sign-out-button" variant="ghost" title="Sign out" icon={<SignOut size={20} color={colors.brandPrimary} />} onPress={signOut} style={styles.signOut} />
          </>
        ) : null}
      </ScrollView>

      <Sheet testID="revoke-sheet" visible={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke this credential?">
        <Text style={styles.sheetText}>Your digital ID will stop working on every campus reader immediately - including any code already on screen. The campus ID office can issue a new one.</Text>
        <View style={styles.chipsWrap}>
          <ChipRow
            testIDPrefix="revoke-reason"
            value={reason}
            onChange={setReason}
            options={[
              { key: "lost_device", label: "Lost device" },
              { key: "stolen_device", label: "Stolen device" },
            ]}
          />
        </View>
        <Button testID="confirm-revoke-button" variant="danger" title="Revoke credential" loading={revoking} onPress={revoke} />
      </Sheet>

      <Sheet testID="photo-permission-sheet" visible={permPrompt !== null} onClose={() => setPermPrompt(null)} title="Add your ID photo">
        <Text style={styles.sheetText}>
          {permPrompt === "blocked" ? "Photo access is turned off for TapID. Enable it in Settings to choose an ID photo." : "TapID needs access to your photos so you can choose a clear headshot for your digital ID."}
        </Text>
        {permPrompt === "blocked" ? (
          <Button testID="open-settings-button" title="Open Settings" onPress={() => Linking.openSettings()} />
        ) : (
          <Button testID="allow-photos-button" title="Allow photo access" onPress={requestPermission} />
        )}
      </Sheet>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  avatarWrap: { marginBottom: spacing.sm },
  cameraBadge: { position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface },
  name: { fontSize: fontSize.xl + 2, fontWeight: "800", color: c.onSurface },
  email: { fontSize: fontSize.base, color: c.muted, marginBottom: spacing.xs },
  list: { paddingVertical: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: fontSize.base, color: c.muted },
  rowValue: { fontSize: fontSize.base, color: c.onSurface, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  credCard: { gap: spacing.sm },
  credHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  credIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  credUid: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface, letterSpacing: 0.5 },
  credSub: { fontSize: fontSize.base, color: c.muted, lineHeight: 20 },
  credMeta: { fontSize: fontSize.sm + 1, color: c.onSurfaceSecondary },
  mt: { marginTop: spacing.sm },
  signOut: { marginTop: spacing.xl },
  sheetText: { fontSize: fontSize.base + 1, color: c.onSurfaceSecondary, lineHeight: 21, marginBottom: spacing.md },
  chipsWrap: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
}));
