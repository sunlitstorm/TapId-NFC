import { CheckCircle, Info, WarningCircle } from "phosphor-react-native";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type ToastTone = "success" | "error" | "info";
type ToastState = { id: number; message: string; tone: ToastTone } | null;
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const iconColor = toast?.tone === "success" ? colors.success : toast?.tone === "error" ? colors.error : colors.info;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View key={toast.id} entering={FadeInUp} exiting={FadeOutUp} pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
          <View testID="toast-message" style={styles.toast}>
            {toast.tone === "success" ? <CheckCircle size={20} color={iconColor} weight="fill" /> : toast.tone === "error" ? <WarningCircle size={20} color={iconColor} weight="fill" /> : <Info size={20} color={iconColor} weight="fill" />}
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, maxWidth: 480, shadowColor: c.surfaceInverse, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  text: { color: c.onSurfaceInverse, fontSize: fontSize.base, fontWeight: "500", flexShrink: 1 },
}));
