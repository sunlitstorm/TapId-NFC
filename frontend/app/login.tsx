import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { ContactlessPayment, ShieldCheck } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Field } from "@/src/components/ui";
import { haptic } from "@/src/haptics";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const BG = "https://images.unsplash.com/photo-1487958449943-2429e8be8625?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return setError("Enter your email and password");
    haptic.medium();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      router.replace(user.role === "admin" ? "/admin" : "/student");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError(null);
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: BG }} style={styles.bg} contentFit="cover" />
      <LinearGradient colors={["transparent", colors.scrim, colors.surfaceInverse]} locations={[0, 0.35, 0.75]} style={styles.bg} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brandBlock}>
          <View style={styles.logo}>
            <ContactlessPayment size={30} color={colors.brandPrimary} weight="bold" />
          </View>
          <Text style={styles.brand}>TapID</Text>
          <Text style={styles.tagline}>Your campus identity, one tap away.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardSub}>Students and administrators use the same portal.</Text>
          <View style={styles.form}>
            <Field testID="login-email-input" label="University email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@university.edu" />
            <Field testID="login-password-input" label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" onSubmitEditing={submit} returnKeyType="go" />
            {error ? (
              <Text testID="login-error" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Button testID="login-submit-button" title="Sign in" size="lg" loading={busy} onPress={submit} />
          </View>
          <View style={styles.demoRow}>
            <Pressable testID="demo-student-button" onPress={() => fill("student@tapid.edu", "Student!2026")} style={styles.demo}>
              <Text style={styles.demoText}>Demo student</Text>
            </Pressable>
            <Pressable testID="demo-admin-button" onPress={() => fill("admin@tapid.edu", "TapIDAdmin!2026")} style={styles.demo}>
              <Text style={styles.demoText}>Demo admin</Text>
            </Pressable>
          </View>
          <Link href="/register" asChild>
            <Pressable testID="go-to-register-link" style={styles.linkRow}>
              <Text style={styles.link}>
                New student? <Text style={styles.linkStrong}>Create your digital ID</Text>
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        <View style={styles.secure}>
          <ShieldCheck size={16} color={colors.onBrandMuted} />
          <Text style={styles.secureText}>Encrypted sessions · Single-use access tokens</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scroll: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: spacing.lg, gap: spacing.xl, maxWidth: 520, width: "100%", alignSelf: "center" },
  brandBlock: { gap: spacing.sm },
  logo: { width: 56, height: 56, borderRadius: radius.md + 4, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  brand: { fontSize: 40, fontWeight: "800", color: c.onSurfaceInverse, letterSpacing: -1 },
  tagline: { fontSize: fontSize.lg, color: c.onBrandMuted },
  card: { backgroundColor: c.surface, borderRadius: radius.lg + 4, padding: spacing.xl, gap: spacing.xs },
  cardTitle: { fontSize: fontSize.xxl, fontWeight: "800", color: c.onSurface },
  cardSub: { fontSize: fontSize.base, color: c.muted },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  error: { color: c.error, fontSize: fontSize.base, fontWeight: "600" },
  demoRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  demo: { flex: 1, minHeight: 40, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  demoText: { fontSize: fontSize.sm + 1, fontWeight: "600", color: c.onSurfaceTertiary },
  linkRow: { minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: spacing.sm },
  link: { fontSize: fontSize.base, color: c.muted },
  linkStrong: { color: c.brandPrimary, fontWeight: "700" },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secureText: { fontSize: fontSize.sm, color: c.onBrandMuted },
}));
