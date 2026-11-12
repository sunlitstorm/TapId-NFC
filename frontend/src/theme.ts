// Design tokens for TapID (light theme). Keys match the "color" block of /app/design_guidelines.json.
// A plain key is a background; its `on` partner is the text/icon color on top of it.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0A0D14",
  surfaceSecondary: "#F5F7FA",
  onSurfaceSecondary: "#3E4C5F",
  surfaceTertiary: "#EAEFF5",
  onSurfaceTertiary: "#2C394B",
  surfaceInverse: "#0B1829",
  onSurfaceInverse: "#FFFFFF",
  muted: "#667085",

  brand: "#00204A",
  onBrand: "#FFFFFF",
  brandPrimary: "#00204A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E0EBFF",
  onBrandSecondary: "#00204A",
  brandTertiary: "#1A365D",
  onBrandTertiary: "#FFFFFF",

  success: "#0B7A44",
  onSuccess: "#FFFFFF",
  successSoft: "#E7F5EE",
  warning: "#B54708",
  onWarning: "#FFFFFF",
  warningSoft: "#FEF4E8",
  error: "#B42318",
  onError: "#FFFFFF",
  errorSoft: "#FDEDEC",
  info: "#026AA2",
  onInfo: "#FFFFFF",
  infoSoft: "#E6F3FA",

  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  divider: "#EAECF0",
  scrim: "rgba(11, 24, 41, 0.55)",
  cardSheen: "rgba(255, 255, 255, 0.14)",
  onBrandMuted: "rgba(255, 255, 255, 0.72)",
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, display: 30 } as const;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export const colors = light;

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
