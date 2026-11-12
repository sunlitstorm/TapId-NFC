import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ClockCounterClockwise, IdentificationCard, UserCircle } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { classicTabOptions, usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function StudentTabs() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "student") return <Redirect href="/admin" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="person.text.rectangle.fill" />
          <NativeTabs.Trigger.Label>ID</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history">
          <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
          <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs screenOptions={classicTabOptions(colors)}>
      <Tabs.Screen name="index" options={{ title: "ID", tabBarButtonTestID: "tab-student-id", tabBarIcon: ({ color, focused }) => <IdentificationCard size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarButtonTestID: "tab-student-history", tabBarIcon: ({ color, focused }) => <ClockCounterClockwise size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarButtonTestID: "tab-student-profile", tabBarIcon: ({ color, focused }) => <UserCircle size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
