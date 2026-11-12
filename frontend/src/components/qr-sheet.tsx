import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { api } from "@/src/api";
import { Sheet } from "@/src/components/sheet";
import { Button } from "@/src/components/ui";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { TapToken } from "@/src/types";

export function QrSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [token, setToken] = useState<TapToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setError(null);
    try {
      setToken(await api<TapToken>("/me/credential/token", { method: "POST" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setToken(null);
    refresh();
  }, [visible, refresh]);

  useEffect(() => {
    if (!visible || !token) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil(token.expires_at - Date.now() / 1000));
      setRemaining(left);
      if (left <= 0) refresh();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [visible, token, refresh]);

  return (
    <Sheet testID="qr-sheet" visible={visible} onClose={onClose} title="QR code fallback">
      <View style={styles.body}>
        <View testID="qr-code-container" style={styles.qrBox}>
          {token ? <QRCode value={token.token} size={220} color={colors.brandPrimary} backgroundColor={colors.surface} /> : error ? null : <ActivityIndicator color={colors.brandPrimary} />}
        </View>
        {error ? (
          <Text testID="qr-error" style={styles.error}>
            {error}
          </Text>
        ) : (
          <>
            <Text testID="qr-countdown" style={styles.countdown}>{token ? `Refreshes in ${remaining}s` : "Generating secure code…"}</Text>
            <Text style={styles.hint}>Show this to a campus reader if NFC is unavailable. Each code is signed, expires in {token?.ttl_seconds ?? 30} seconds and works only once.</Text>
            {token ? <Text testID="qr-code-ref" style={styles.ref}>{`Code ref ${token.nonce.slice(-8).toUpperCase()}`}</Text> : null}
          </>
        )}
        <Button testID="qr-refresh-button" title="Generate new code" variant="secondary" onPress={refresh} style={styles.full} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  body: { alignItems: "center", gap: spacing.md },
  qrBox: { width: 260, height: 260, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  countdown: { fontSize: fontSize.lg, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  hint: { fontSize: fontSize.base, color: c.muted, textAlign: "center", lineHeight: 20 },
  ref: { fontSize: fontSize.sm, color: c.onSurfaceTertiary, fontWeight: "600", letterSpacing: 1 },
  error: { color: c.error, fontSize: fontSize.base, textAlign: "center" },
  full: { alignSelf: "stretch" },
}));
