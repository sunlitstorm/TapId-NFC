import { useQueryClient } from "@tanstack/react-query";
import { Buildings, ContactlessPayment, LockKey } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { api } from "@/src/api";
import { Sheet } from "@/src/components/sheet";
import { Button } from "@/src/components/ui";
import { VerificationResultView } from "@/src/components/verification-result";
import { haptic } from "@/src/haptics";
import { activeTransport } from "@/src/nfc/transport";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Building, TapToken, VerificationResult } from "@/src/types";

type Phase = "select" | "processing" | "result";

export function TapSheet({ visible, onClose, buildings }: { visible: boolean; onClose: () => void; buildings: Building[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("select");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setPhase("select");
      setResult(null);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    ring.value = 0;
    if (phase === "processing") ring.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [phase, ring]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ring.value * 0.8 }], opacity: 1 - ring.value }));

  const tap = async (b: Building) => {
    haptic.heavy();
    setPhase("processing");
    setError(null);
    try {
      const started = Date.now();
      const token = await api<TapToken>("/me/credential/token", { method: "POST" });
      const res = await activeTransport.present(token.token, b.id, "nfc");
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      res.granted ? haptic.success() : haptic.error();
      setResult(res);
      setPhase("result");
      qc.invalidateQueries({ queryKey: ["history"] });
    } catch (e: any) {
      haptic.error();
      setError(e.message);
      setPhase("select");
    }
  };

  return (
    <Sheet testID="tap-sheet" visible={visible} onClose={onClose} title={phase === "result" ? "Reader response" : "Simulated NFC tap"}>
      {phase === "select" && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Text style={styles.hint}>Choose the door you are tapping. This simulates holding your phone to a campus reader - no NFC hardware is used.</Text>
          {error ? (
            <Text testID="tap-sheet-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {buildings.map((b) => (
            <Pressable key={b.id} testID={`tap-building-${b.code}`} onPress={() => tap(b)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowIcon}>
                <Buildings size={22} color={colors.brandPrimary} weight="duotone" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{b.name}</Text>
                <Text style={styles.rowSub}>{b.description || b.code}</Text>
              </View>
              {!b.permitted ? <LockKey size={18} color={colors.muted} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
      {phase === "processing" && (
        <View testID="tap-processing" style={styles.processing}>
          <View style={styles.pulseWrap}>
            <Animated.View style={[styles.pulseRing, ringStyle]} />
            <View style={styles.pulseCore}>
              <ContactlessPayment size={44} color={colors.onBrandPrimary} weight="bold" />
            </View>
          </View>
          <Text style={styles.processingTitle}>Verifying credential…</Text>
          <Text style={styles.hint}>Signed one-time token sent to the verification API</Text>
        </View>
      )}
      {phase === "result" && result && (
        <View style={styles.resultWrap}>
          <VerificationResultView result={result} />
          <View style={styles.actions}>
            <Button testID="tap-again-button" title="Tap again" variant="secondary" style={styles.flex} onPress={() => setPhase("select")} />
            <Button testID="tap-done-button" title="Done" style={styles.flex} onPress={onClose} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  hint: { fontSize: fontSize.base, color: c.muted, lineHeight: 20, textAlign: "left" },
  error: { color: c.error, fontSize: fontSize.base, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, minHeight: 64 },
  rowPressed: { backgroundColor: c.surfaceSecondary },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: fontSize.lg, fontWeight: "600", color: c.onSurface },
  rowSub: { fontSize: fontSize.sm, color: c.muted, marginTop: 2 },
  processing: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.md },
  pulseWrap: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: c.brandSecondary },
  pulseCore: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  processingTitle: { fontSize: fontSize.xl, fontWeight: "700", color: c.onSurface },
  resultWrap: { gap: spacing.lg },
  actions: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
}));
