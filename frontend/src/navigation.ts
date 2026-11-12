import { Platform } from "react-native";

import type { ThemeColors } from "@/src/theme";

export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export function classicTabOptions(colors: ThemeColors) {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.brandPrimary,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      ...(Platform.OS === "web" ? { height: 64 } : {}),
    },
    tabBarItemStyle: { alignSelf: "center" as const },
    tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  };
}
