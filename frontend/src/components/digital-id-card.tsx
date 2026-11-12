import { LinearGradient } from "expo-linear-gradient";
import { ContactlessPayment } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Avatar } from "@/src/components/ui";
import { capitalize } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Credential, Student } from "@/src/types";

export function DigitalIdCard({ student, credential }: { student: Student; credential: Credential | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const shimmer = useSharedValue(-1);
  const pulse = useSharedValue(1);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, true);
    pulse.value = withRepeat(withTiming(0.3, { duration: 900 }), -1, true);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [shimmer, pulse]);

  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimmer.value * 160 }, { rotate: "20deg" }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const valid = credential?.status === "active" && student.enrollment_status === "active";

  return (
    <View testID="digital-id-card" style={styles.shadow}>
      <LinearGradient colors={[colors.brandPrimary, colors.brandTertiary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Animated.View pointerEvents="none" style={[styles.sheen, shimmerStyle]}>
          <LinearGradient colors={["transparent", colors.cardSheen, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>TapID</Text>
            <Text style={styles.uni}>Campus Student Credential</Text>
          </View>
          <ContactlessPayment size={28} color={colors.onBrandPrimary} weight="duotone" />
        </View>

        <View style={styles.mid}>
          <View style={styles.photoRing}>
            <Avatar testID="id-card-photo" path={student.photo_url} name={student.full_name} size={76} />
          </View>
          <View style={styles.info}>
            <Text testID="id-card-name" style={styles.name} numberOfLines={2}>
              {student.full_name}
            </Text>
            <Text style={styles.program} numberOfLines={1}>
              {student.program}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View>
            <Text style={styles.label}>Student No.</Text>
            <Text testID="id-card-number" style={styles.value}>
              {student.student_number}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>Enrollment</Text>
            <Text testID="id-card-enrollment" style={styles.value}>
              {capitalize(student.enrollment_status)}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>Credential</Text>
            <Text testID="id-card-credential-uid" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {credential ? credential.credential_uid : "Not issued"}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.live}>
            <Animated.View style={[styles.liveDot, { backgroundColor: valid ? colors.success : colors.error }, pulseStyle]} />
            <Text testID="id-card-validity" style={styles.liveText}>
              {valid ? "VALID · LIVE" : credential?.status === "revoked" ? "REVOKED" : "INACTIVE"}
            </Text>
          </View>
          <Text style={styles.clock}>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  shadow: { borderRadius: radius.lg + 4, shadowColor: c.brandPrimary, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  card: { borderRadius: radius.lg + 4, padding: spacing.xl, overflow: "hidden", gap: spacing.lg },
  sheen: { position: "absolute", top: -80, bottom: -80, left: "25%", width: 120 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { color: c.onBrandPrimary, fontSize: fontSize.xl, fontWeight: "800", letterSpacing: -0.3 },
  uni: { color: c.onBrandMuted, fontSize: fontSize.sm, marginTop: 2, letterSpacing: 0.4 },
  mid: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  photoRing: { padding: 3, borderRadius: 44, borderWidth: 2, borderColor: c.cardSheen },
  info: { flex: 1, gap: 4 },
  name: { color: c.onBrandPrimary, fontSize: fontSize.xxl, fontWeight: "800", letterSpacing: -0.4 },
  program: { color: c.onBrandMuted, fontSize: fontSize.base },
  grid: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  gridCell: { flexShrink: 1 },
  label: { color: c.onBrandMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  value: { color: c.onBrandPrimary, fontSize: fontSize.base, fontWeight: "700", marginTop: 4, fontVariant: ["tabular-nums"] },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: c.cardSheen, paddingTop: spacing.md },
  live: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { color: c.onBrandPrimary, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 1.2 },
  clock: { color: c.onBrandMuted, fontSize: fontSize.sm, fontVariant: ["tabular-nums"], fontWeight: "600" },
}));
