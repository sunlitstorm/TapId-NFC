import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactlessPayment, Repeat, WarningCircle } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { Button, ChipRow, Field, ScreenHeader, SectionTitle, Skeleton } from "@/src/components/ui";
import { VerificationResultView } from "@/src/components/verification-result";
import { haptic } from "@/src/haptics";
import { usesNativeTabs } from "@/src/navigation";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { ActiveCredential, Building, VerificationResult } from "@/src/types";

export default function ReaderConsole() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const qc = useQueryClient();
  const toast = useToast();
  const buildings = useQuery({ queryKey: ["buildings"], queryFn: () => api<Building[]>("/admin/buildings") });
  const creds = useQuery({ queryKey: ["active-credentials"], queryFn: () => api<ActiveCredential[]>("/admin/credentials/active") });
  const [buildingId, setBuildingId] = useState<string>("");
  const [credId, setCredId] = useState<string>("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState<"tap" | "replay" | "raw" | null>(null);

  useEffect(() => {
    if (!buildingId && buildings.data?.length) setBuildingId(buildings.data[0].id);
  }, [buildings.data, buildingId]);

  const finish = (r: VerificationResult) => {
    r.granted ? haptic.success() : haptic.error();
    setResult(r);
    qc.invalidateQueries({ queryKey: ["analytics"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
  };

  const run = async (kind: "tap" | "replay" | "raw") => {
    if (!buildingId) return toast("Select a building", "error");
    haptic.heavy();
    setBusy(kind);
    try {
      if (kind === "tap") {
        if (!credId) return toast("Select a credential to present", "error");
        const r = await api<VerificationResult>("/admin/reader/simulate", { method: "POST", body: { credential_id: credId, building_id: buildingId } });
        setLastToken(r.presented_token ?? null);
        finish(r);
      } else {
        const token = kind === "replay" ? lastToken : rawToken.trim();
        if (!token) return toast("Paste a token first", "error");
        finish(await api<VerificationResult>("/admin/reader/verify", { method: "POST", body: { token, building_id: buildingId, method: kind === "raw" ? "qr" : "nfc" } }));
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader topInset={insets.top} eyebrow="Verification" title="Reader" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]}>
        <View testID="reader-simulation-banner" style={styles.banner}>
          <WarningCircle size={20} color={colors.warning} weight="fill" />
          <Text style={styles.bannerText}>Simulated NFC reader. This is a software simulation - no NFC hardware is connected. Verification, replay protection and logging are real.</Text>
        </View>

        <SectionTitle>Reader location</SectionTitle>
        <View style={styles.bleed}>
          {buildings.isLoading ? <Skeleton height={36} style={styles.mx} /> : <ChipRow testIDPrefix="reader-building" value={buildingId} onChange={setBuildingId} options={(buildings.data ?? []).map((b) => ({ key: b.id, label: b.name }))} />}
        </View>

        <SectionTitle right={<Text style={styles.meta}>{`${creds.data?.length ?? 0} active`}</Text>}>Present credential</SectionTitle>
        <View style={styles.credList}>
          {creds.isLoading ? (
            <Skeleton height={120} />
          ) : creds.data?.length ? (
            creds.data.map((c) => {
              const selected = c.id === credId;
              return (
                <Pressable key={c.id} testID={`reader-credential-${c.student_number}`} onPress={() => setCredId(c.id)} style={[styles.credRow, selected && styles.credRowSelected]}>
                  <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.flex}>
                    <Text style={styles.credName}>{c.student_name}</Text>
                    <Text style={styles.credSub}>{`${c.student_number} · ${c.credential_uid}`}</Text>
                  </View>
                  {c.enrollment_status !== "active" ? <Text style={styles.warnTag}>{c.enrollment_status.toUpperCase()}</Text> : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.meta}>No active credentials. Issue a digital ID from the Students tab.</Text>
          )}
        </View>

        <Button testID="reader-simulate-tap-button" size="lg" title="Simulate NFC tap" loading={busy === "tap"} icon={<ContactlessPayment size={22} color={colors.onBrandPrimary} weight="bold" />} onPress={() => run("tap")} style={styles.mt} />

        {result ? (
          <View style={styles.mtLg}>
            <VerificationResultView result={result} />
            {lastToken ? <Button testID="reader-replay-button" variant="ghost" title="Replay last token (attack test)" loading={busy === "replay"} icon={<Repeat size={20} color={colors.brandPrimary} />} onPress={() => run("replay")} style={styles.mt} /> : null}
          </View>
        ) : null}

        <SectionTitle>QR / raw token verification</SectionTitle>
        <Field testID="reader-raw-token-input" value={rawToken} onChangeText={setRawToken} placeholder="Paste a scanned QR token" multiline autoCapitalize="none" autoCorrect={false} style={styles.tokenInput} />
        <Button testID="reader-verify-token-button" variant="secondary" title="Verify token" loading={busy === "raw"} onPress={() => run("raw")} style={styles.mt} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  content: { padding: spacing.lg, maxWidth: 720, width: "100%", alignSelf: "center" },
  banner: { flexDirection: "row", gap: spacing.sm, backgroundColor: c.warningSoft, padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
  bannerText: { flex: 1, color: c.onSurfaceSecondary, fontSize: fontSize.sm + 1, lineHeight: 18 },
  bleed: { marginHorizontal: -spacing.lg },
  mx: { marginHorizontal: spacing.lg },
  meta: { fontSize: fontSize.sm + 1, color: c.muted },
  credList: { gap: spacing.sm },
  credRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, minHeight: 60 },
  credRowSelected: { borderColor: c.brandPrimary, backgroundColor: c.brandSecondary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: c.brandPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandPrimary },
  flex: { flex: 1 },
  credName: { fontSize: fontSize.base + 1, fontWeight: "700", color: c.onSurface },
  credSub: { fontSize: fontSize.sm, color: c.muted, marginTop: 2 },
  warnTag: { fontSize: 10, fontWeight: "800", color: c.warning, letterSpacing: 0.8 },
  mt: { marginTop: spacing.md },
  mtLg: { marginTop: spacing.xl },
  tokenInput: { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md, fontSize: fontSize.sm },
}));
