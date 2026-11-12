import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RegisterInput, useAuth } from "@/src/auth";
import { Button, Field } from "@/src/components/ui";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";

type Errors = Partial<Record<keyof RegisterInput | "confirm", string>>;

export default function Register() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterInput & { confirm: string }>({ full_name: "", email: "", student_number: "", program: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Errors = {};
    if (form.full_name.trim().length < 2) e.full_name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email";
    if (!/^[A-Za-z0-9-]{4,20}$/.test(form.student_number.trim())) e.student_number = "4-20 letters, numbers or dashes";
    if (form.program.trim().length < 2) e.program = "Enter your program";
    if (form.password.length < 8) e.password = "At least 8 characters";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setServerError(null);
    try {
      const { confirm: _c, ...body } = form;
      await register({ ...body, email: body.email.trim() });
      router.replace("/student");
    } catch (e: any) {
      setServerError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable testID="register-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))} style={styles.back}>
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Create your digital ID</Text>
        <Text style={styles.sub}>Your account stays pending until the campus ID office verifies your enrollment.</Text>
        <View style={styles.form}>
          <Field testID="register-name-input" label="Full name" value={form.full_name} onChangeText={set("full_name")} error={errors.full_name} placeholder="Alex Morgan" autoComplete="name" />
          <Field testID="register-email-input" label="University email" value={form.email} onChangeText={set("email")} error={errors.email} autoCapitalize="none" keyboardType="email-address" placeholder="you@university.edu" />
          <Field testID="register-student-number-input" label="Student number" value={form.student_number} onChangeText={set("student_number")} error={errors.student_number} autoCapitalize="characters" placeholder="S2026123" />
          <Field testID="register-program-input" label="Program" value={form.program} onChangeText={set("program")} error={errors.program} placeholder="BSc Computer Science" />
          <Field testID="register-password-input" label="Password" value={form.password} onChangeText={set("password")} error={errors.password} secureTextEntry placeholder="At least 8 characters" />
          <Field testID="register-confirm-input" label="Confirm password" value={form.confirm} onChangeText={set("confirm")} error={errors.confirm} secureTextEntry placeholder="Repeat password" />
          {serverError ? (
            <Text testID="register-error" style={styles.error}>
              {serverError}
            </Text>
          ) : null}
          <Button testID="register-submit-button" title="Create account" size="lg" loading={busy} onPress={submit} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontSize: fontSize.display, fontWeight: "800", color: c.onSurface, letterSpacing: -0.8 },
  sub: { fontSize: fontSize.base + 1, color: c.muted, marginTop: spacing.sm, lineHeight: 21 },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  error: { color: c.error, fontSize: fontSize.base, fontWeight: "600" },
}));
