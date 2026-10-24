import { Tabs } from "expo-router";
import { useTheme } from "../../lib/ui/theme";
import { Icon, type IconName } from "../../components/Icon";

/** The bottom navigation, as on the website: Today, Learn, Quiz, Practice, More. Reviews and Roadmap open from Today and Learn. */
export default function TabsLayout() {
  const { palette: c } = useTheme();
  const tab = (name: IconName) => {
    const TabIcon = (props: { color: unknown }) => <Icon name={name} size={22} color={String(props.color)} />;
    return TabIcon;
  };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.fg,
        headerTitleStyle: { fontFamily: "BricolageGrotesque_700Bold" },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 66, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: "BricolageGrotesque_600SemiBold" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", headerShown: false, tabBarIcon: tab("home") }} />
      <Tabs.Screen name="learn" options={{ title: "Learn", headerShown: false, tabBarIcon: tab("book") }} />
      <Tabs.Screen name="quiz" options={{ title: "Quiz", headerShown: false, tabBarIcon: tab("bolt") }} />
      <Tabs.Screen name="practice" options={{ title: "Practice", headerShown: false, tabBarIcon: tab("code") }} />
      <Tabs.Screen name="profile" options={{ title: "More", headerShown: false, tabBarIcon: tab("grid") }} />
      <Tabs.Screen name="reviews" options={{ title: "Reviews", href: null }} />
    </Tabs>
  );
}
