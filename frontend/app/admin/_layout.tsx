import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ChartBar, ContactlessPayment, ListBullets, Users } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { classicTabOptions, usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function AdminTabs() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin") return <Redirect href="/student" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
          <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="students">
          <NativeTabs.Trigger.Icon sf="person.2.fill" />
          <NativeTabs.Trigger.Label>Students</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reader">
          <NativeTabs.Trigger.Icon sf="wave.3.right.circle.fill" />
          <NativeTabs.Trigger.Label>Reader</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="logs">
          <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.fill" />
          <NativeTabs.Trigger.Label>Logs</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs screenOptions={classicTabOptions(colors)}>
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarButtonTestID: "tab-admin-overview", tabBarIcon: ({ color, focused }) => <ChartBar size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="students" options={{ title: "Students", tabBarButtonTestID: "tab-admin-students", tabBarIcon: ({ color, focused }) => <Users size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="reader" options={{ title: "Reader", tabBarButtonTestID: "tab-admin-reader", tabBarIcon: ({ color, focused }) => <ContactlessPayment size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
      <Tabs.Screen name="logs" options={{ title: "Logs", tabBarButtonTestID: "tab-admin-logs", tabBarIcon: ({ color, focused }) => <ListBullets size={24} color={color as string} weight={focused ? "fill" : "regular"} /> }} />
    </Tabs>
  );
}
