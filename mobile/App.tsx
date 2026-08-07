import { useState, type ComponentType } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  Layers3,
  Search,
  Warehouse,
  type LucideProps
} from "lucide-react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView
} from "react-native-safe-area-context";
import { SearchScreen } from "./src/SearchScreen";
import { WarehouseScreen } from "./src/WarehouseScreen";
import { colors } from "./src/theme";

type Tab = "search" | "warehouse";
type IconType = ComponentType<LucideProps>;

const tabs: { id: Tab; label: string; icon: IconType }[] = [
  { id: "search", label: "Tra Log", icon: Search },
  { id: "warehouse", label: "Nhập kho", icon: Warehouse }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [dataVersion, setDataVersion] = useState(0);

  function markDataChanged() {
    setDataVersion((current) => current + 1);
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.appHeader}>
          <View style={styles.brandMark}>
            <Layers3 color={colors.surface} size={25} strokeWidth={2.3} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>NHẬP GỖ</Text>
            <Text style={styles.brandContext}>Kiểm nhận tại kho</Text>
          </View>
        </View>

        <View style={styles.content}>
          {activeTab === "search" ? (
            <SearchScreen onDataChanged={markDataChanged} />
          ) : null}
          {activeTab === "warehouse" ? (
            <WarehouseScreen refreshKey={dataVersion} />
          ) : null}
        </View>

        <View style={styles.bottomNav}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <Pressable
                accessibilityRole="button"
                key={tab.id}
                onPress={() => {
                  Keyboard.dismiss();
                  setActiveTab(tab.id);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  active && styles.activeTab,
                  { opacity: pressed ? 0.68 : 1 }
                ]}
              >
                <Icon
                  color={active ? colors.primary : colors.muted}
                  size={22}
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.tabText, active && styles.activeTabText]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  appHeader: {
    height: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  brandText: {
    minWidth: 0
  },
  brandName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0
  },
  brandContext: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  content: {
    flex: 1,
    backgroundColor: colors.background
  },
  bottomNav: {
    height: 66,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 65,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderTopWidth: 3,
    borderTopColor: "transparent"
  },
  activeTab: {
    backgroundColor: colors.primarySoft,
    borderTopColor: colors.primary
  },
  tabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: "900"
  }
});
