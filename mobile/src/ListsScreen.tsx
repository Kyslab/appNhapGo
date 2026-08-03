import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";
import {
  ArrowLeft,
  ChevronRight,
  Container,
  PackageOpen
} from "lucide-react-native";
import {
  ApiError,
  getImportLogs,
  getImports
} from "./api";
import {
  EmptyState,
  IconButton,
  LogCard,
  Notice,
  screenText
} from "./components";
import { colors, shadows } from "./theme";
import type { LogStatus, WoodImport, WoodLog } from "./types";

type Filter = "all" | LogStatus;

export function ListsScreen({ refreshKey }: { refreshKey: number }) {
  const [imports, setImports] = useState<WoodImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<WoodImport | null>(null);
  const [logs, setLogs] = useState<WoodLog[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadImports();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedImport) {
      loadLogs(selectedImport, filter);
    }
  }, [selectedImport?.id, filter, refreshKey]);

  function errorMessage(caught: unknown): string {
    return caught instanceof ApiError || caught instanceof Error
      ? caught.message
      : "Không thể tải danh sách.";
  }

  async function loadImports() {
    setLoading(true);
    setError(null);

    try {
      const next = await getImports();
      setImports(next);
      setSelectedImport((current) =>
        current ? next.find((item) => item.id === current.id) ?? null : null
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(item: WoodImport, nextFilter: Filter) {
    setLoading(true);
    setError(null);

    try {
      setLogs(
        await getImportLogs(
          item.id,
          nextFilter === "all" ? undefined : nextFilter
        )
      );
    } catch (caught) {
      setLogs([]);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  if (selectedImport) {
    return (
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={loading}
        onRefresh={() => loadLogs(selectedImport, filter)}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.detailTitleRow}>
              <IconButton
                icon={ArrowLeft}
                label="Quay lại danh sách"
                onPress={() => {
                  setSelectedImport(null);
                  setFilter("all");
                }}
              />
              <View style={styles.detailIdentity}>
                <Text style={styles.detailCode} numberOfLines={1}>
                  {selectedImport.lotName || selectedImport.listCode}
                </Text>
                <Text style={styles.detailFile} numberOfLines={1}>
                  {selectedImport.lotName ? selectedImport.listCode + " · " : ""}
                  {selectedImport.originalFilename}
                </Text>
              </View>
            </View>
            <View style={styles.summaryBand}>
              <SummaryMetric
                label="Tổng cây"
                value={selectedImport.totalLogs}
              />
              <SummaryMetric
                label="Đã nhận"
                value={selectedImport.receivedLogs}
              />
              <SummaryMetric
                label="Đang chờ"
                value={selectedImport.pendingLogs}
              />
            </View>
            <ShipmentInformation item={selectedImport} />
            <SegmentedFilter value={filter} onChange={setFilter} />
            {error ? (
              <Notice title="Không tải được dữ liệu" tone="error">
                {error}
              </Notice>
            ) : null}
            <Text style={styles.resultText}>{logs.length + " cây"}</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? <EmptyState title="Không có cây ở trạng thái này" /> : null
        }
        renderItem={({ item }) => <LogCard log={item} />}
      />
    );
  }

  return (
    <FlatList
      data={imports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshing={loading}
      onRefresh={loadImports}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={screenText.title}>Các danh sách gỗ</Text>
          {error ? (
            <Notice title="Không tải được dữ liệu" tone="error">
              {error}
            </Notice>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !loading ? <EmptyState title="Chưa có danh sách nào" /> : null
      }
      renderItem={({ item }) => (
        <ImportRow item={item} onPress={() => setSelectedImport(item)} />
      )}
    />
  );
}

function ImportRow({
  item,
  onPress
}: {
  item: WoodImport;
  onPress: () => void;
}) {
  const progress =
    item.totalLogs === 0 ? 0 : item.receivedLogs / item.totalLogs;
  const ShipmentIcon =
    item.shipmentType === "container" ? Container : PackageOpen;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.importRow,
        { opacity: pressed ? 0.82 : 1 }
      ]}
    >
      <View style={styles.listIcon}>
        <ShipmentIcon color={colors.primary} size={23} />
      </View>
      <View style={styles.importBody}>
        <Text style={styles.importCode} numberOfLines={1}>
          {item.lotName || item.listCode}
        </Text>
        <Text style={styles.importMeta}>
          {item.shipmentType === "container"
            ? item.listCode +
              " · " +
              item.container20Count +
              "C20 · " +
              item.container40Count +
              "C40"
            : item.listCode + " · Hàng rời"}
        </Text>
        <Text style={styles.importMeta}>
          {item.receivedLogs + "/" + item.totalLogs + " cây đã nhận"}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: (Math.round(progress * 100) + "%") as DimensionValue }
            ]}
          />
        </View>
      </View>
      <ChevronRight color={colors.muted} size={22} />
    </Pressable>
  );
}

function ShipmentInformation({ item }: { item: WoodImport }) {
  if (item.shipmentType !== "container") {
    return (
      <View style={styles.shipmentBand}>
        <ShipmentRow label="Hình thức nhập" value="Hàng rời" />
      </View>
    );
  }

  return (
    <View style={styles.shipmentBand}>
      <Text style={styles.shipmentHeading}>Thông tin lô hàng</Text>
      <ShipmentRow
        label="Chủ hàng"
        value={(item.ownerName || "--") + " · " + (item.contactPhone || "--")}
      />
      <ShipmentRow label="Loại gỗ" value={item.woodSpecies || "--"} />
      <ShipmentRow
        label="Container"
        value={
          item.container20Count +
          " Cont 20' · " +
          item.container40Count +
          " Cont 40'"
        }
      />
      <ShipmentRow
        label="Nơi lấy cont"
        value={item.containerPickupLocation || "--"}
      />
      <ShipmentRow
        label="Ngày bắt đầu"
        value={formatImportDate(item.intakeStartDate)}
      />
      <ShipmentRow
        label="Tổng lô"
        value={
          item.totalQuantity && item.quantityUnit
            ? item.totalQuantity + " " + quantityUnitLabel(item.quantityUnit)
            : "--"
        }
      />
    </View>
  );
}

function ShipmentRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.shipmentRow}>
      <Text style={styles.shipmentTitle}>{label}</Text>
      <Text style={styles.shipmentValue}>{value}</Text>
    </View>
  );
}

function quantityUnitLabel(value: "logs" | "packages" | "boxes"): string {
  return { logs: "lóng", packages: "kiện", boxes: "hộp" }[value];
}

function formatImportDate(value: string | null): string {
  const parts = value?.slice(0, 10).split("-");
  return parts?.length === 3 ? parts.reverse().join("/") : "--";
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SegmentedFilter({
  value,
  onChange
}: {
  value: Filter;
  onChange: (value: Filter) => void;
}) {
  const options: { value: Filter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Đang chờ" },
    { value: "received", label: "Đã nhận" }
  ];

  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active && styles.segmentActive
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                active && styles.segmentTextActive
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24
  },
  header: {
    gap: 12,
    marginBottom: 12
  },
  separator: {
    height: 10
  },
  importRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 13,
    ...shadows.card
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  importBody: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  importCode: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0
  },
  importMeta: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: colors.border
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary
  },
  detailTitleRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  detailIdentity: {
    flex: 1,
    minWidth: 0
  },
  detailCode: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0
  },
  detailFile: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  summaryBand: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  summaryMetric: {
    flex: 1,
    minHeight: 65,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0
  },
  shipmentBand: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    gap: 7
  },
  shipmentHeading: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    paddingHorizontal: 12
  },
  shipmentRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 12
  },
  shipmentTitle: {
    width: 94,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  shipmentValue: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    letterSpacing: 0
  },
  segmented: {
    height: 42,
    flexDirection: "row",
    padding: 3,
    gap: 3,
    borderRadius: 7,
    backgroundColor: colors.border
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: "800"
  },
  resultText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  }
});
