import { CheckCircle, XCircle } from "phosphor-react-native";
import { Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { formatDateTime } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { VerificationResult } from "@/src/types";

export function VerificationResultView({ result }: { result: VerificationResult }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = result.granted ? colors.success : colors.error;
  return (
    <View testID="verification-result" style={[styles.wrap, { backgroundColor: result.granted ? colors.successSoft : colors.errorSoft }]}>
      <Animated.View entering={ZoomIn.springify()}>
        {result.granted ? <CheckCircle size={84} color={tone} weight="fill" /> : <XCircle size={84} color={tone} weight="fill" />}
      </Animated.View>
      <Text testID="verification-result-title" style={[styles.title, { color: tone }]}>
        {result.granted ? "Access granted" : "Access denied"}
      </Text>
      {!result.granted ? (
        <Text testID="verification-result-message" style={styles.message}>
          {result.message}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={styles.metaText}>{result.building ? `${result.building.name} (${result.building.code})` : "Unknown building"}</Text>
        {result.student ? <Text style={styles.metaText}>{`${result.student.full_name} · ${result.student.student_number}`}</Text> : null}
        <Text style={styles.metaSub}>{`${formatDateTime(result.verified_at)} · ${result.method.toUpperCase()} · ${result.reader_id}`}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", padding: spacing.xl, borderRadius: radius.lg, gap: spacing.sm },
  title: { fontSize: fontSize.xxl + 2, fontWeight: "800", letterSpacing: -0.4 },
  message: { fontSize: fontSize.lg, color: c.onSurfaceSecondary, textAlign: "center" },
  meta: { alignItems: "center", gap: 2, marginTop: spacing.sm },
  metaText: { fontSize: fontSize.base, color: c.onSurface, fontWeight: "600" },
  metaSub: { fontSize: fontSize.sm, color: c.muted, marginTop: 2 },
}));
