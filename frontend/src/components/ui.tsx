import { Image } from "expo-image";
import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";

import { mediaUrl } from "@/src/api";
import { initials, Tone } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  testID: string;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
};

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, testID, style, size = "md" }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandSecondary, danger: colors.onError, ghost: colors.brandPrimary }[variant];
  const isDisabled = disabled || loading;
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[styles.btn, styles[`btn_${variant}`], size === "lg" && styles.btnLg, isDisabled && styles.btnDisabled, anim, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </AnimatedPressable>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: Tone; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map = {
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    error: [colors.errorSoft, colors.error],
    info: [colors.infoSoft, colors.info],
    neutral: [colors.surfaceTertiary, colors.onSurfaceTertiary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: fg }]} />
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, error, testID, ...props }: TextInputProps & { label?: string; error?: string; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, props.style]}
      />
      {error ? (
        <Text testID={`${testID}-error`} style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function ChipRow<K extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  testIDPrefix: string;
}) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable key={o.key} testID={`${testIDPrefix}-${o.key}`} onPress={() => onChange(o.key)} style={[styles.chip, selected && styles.chipSelected]}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function EmptyState({ icon, title, message, action, testID }: { icon: ReactNode; title: string; message: string; action?: ReactNode; testID: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMsg}>{message}</Text>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry, testID }: { message: string; onRetry: () => void; testID: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={styles.errorBox}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMsg}>{message}</Text>
      <Button testID={`${testID}-retry`} title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function Skeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.skeleton, { height }, anim, style]} />;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Avatar({ path, name, size = 48, testID }: { path?: string | null; name: string; size?: number; testID?: string }) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const uri = mediaUrl(path);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return <Image testID={testID} source={{ uri }} style={[styles.avatar, dim]} contentFit="cover" transition={200} onError={() => setFailed(true)} />;
  }
  return (
    <View testID={testID} style={[styles.avatar, styles.avatarFallback, dim]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

export function ScreenHeader({ eyebrow, title, right, topInset, children }: { eyebrow?: string; title: string; right?: ReactNode; topInset: number; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitles}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  btn: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  btnLg: { minHeight: 56 },
  btn_primary: { backgroundColor: c.brandPrimary },
  btn_secondary: { backgroundColor: c.brandSecondary },
  btn_danger: { backgroundColor: c.error },
  btn_ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: c.borderStrong },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: fontSize.lg, fontWeight: "600", letterSpacing: 0.2 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, shadowColor: c.surfaceInverse, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: fontSize.sm, fontWeight: "600" },
  field: { gap: 6 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: "600", color: c.onSurfaceSecondary, letterSpacing: 0.3, textTransform: "uppercase" },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, fontSize: fontSize.lg, color: c.onSurface },
  inputFocused: { borderColor: c.brandPrimary, backgroundColor: c.surface },
  inputError: { borderColor: c.error },
  fieldError: { color: c.error, fontSize: fontSize.sm },
  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center" },
  chipSelected: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontSize: fontSize.base, fontWeight: "600", color: c.onSurfaceSecondary },
  chipTextSelected: { color: c.onBrandPrimary },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.onSurface },
  emptyMsg: { fontSize: fontSize.base, color: c.muted, textAlign: "center", lineHeight: 20, marginBottom: spacing.sm },
  errorBox: { padding: spacing.xl, gap: spacing.sm, alignItems: "stretch", backgroundColor: c.errorSoft, borderRadius: radius.lg, margin: spacing.lg },
  errorTitle: { fontSize: fontSize.lg, fontWeight: "700", color: c.error },
  errorMsg: { fontSize: fontSize.base, color: c.onSurfaceSecondary, marginBottom: spacing.sm },
  skeleton: { backgroundColor: c.surfaceTertiary, borderRadius: radius.lg },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: "700", color: c.muted, letterSpacing: 1, textTransform: "uppercase" },
  avatar: { backgroundColor: c.surfaceTertiary },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: c.brandSecondary },
  avatarText: { fontWeight: "700", color: c.onBrandSecondary },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.md },
  headerTitles: { flex: 1 },
  eyebrow: { fontSize: fontSize.sm, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  headerTitle: { fontSize: fontSize.xxl + 4, fontWeight: "800", color: c.onSurface, letterSpacing: -0.5 },
}));
