import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  Camera,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Images,
  X
} from "lucide-react-native";
import {
  ApiError,
  getImports,
  getLogPhotos,
  getWarehouse
} from "./api";
import {
  EmptyState,
  IconButton,
  Notice,
  screenText
} from "./components";
import { colors, shadows } from "./theme";
import { PhotoImage } from "./PhotoImage";
import { formatIntakeTime } from "./intake";
import type {
  WarehouseOverview,
  WoodImport,
  WoodLog,
  WoodLogPhoto
} from "./types";

export function WarehouseScreen({ refreshKey }: { refreshKey: number }) {
  const [overview, setOverview] = useState<WarehouseOverview | null>(null);
  const [imports, setImports] = useState<WoodImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WoodLog | null>(null);
  const [photos, setPhotos] = useState<WoodLogPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, [refreshKey]);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const [nextOverview, nextImports] = await Promise.all([
        getWarehouse(),
        getImports()
      ]);
      setOverview(nextOverview);
      setImports(nextImports);
      setSelectedImportId((current) =>
        current === "all" || nextImports.some((item) => item.id === current)
          ? current
          : "all"
      );
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải dữ liệu nhập kho."));
    } finally {
      setLoading(false);
    }
  }

  async function openLog(log: WoodLog) {
    setSelectedLog(log);
    setPhotos([]);
    setSelectedPhotoId(log.latestPhotoId);
    setLoadingPhotos(true);
    setPhotoError(null);

    try {
      const next = await getLogPhotos(log.id);
      setPhotos(next);
      setSelectedPhotoId((current) => current ?? next[0]?.id ?? null);
    } catch (caught) {
      setPhotoError(errorMessage(caught, "Không thể tải danh sách ảnh."));
    } finally {
      setLoadingPhotos(false);
    }
  }

  function closeLog() {
    setSelectedLog(null);
    setPhotos([]);
    setSelectedPhotoId(null);
    setPhotoError(null);
  }

  const currentPhotoId = useMemo(
    () => selectedPhotoId ?? selectedLog?.latestPhotoId ?? null,
    [selectedLog?.latestPhotoId, selectedPhotoId]
  );
  const summary = overview?.summary;
  const logs = overview?.logs ?? [];
  const visibleLogs = useMemo(
    () =>
      selectedImportId === "all"
        ? logs
        : logs.filter((log) => log.importId === selectedImportId),
    [logs, selectedImportId]
  );
  const selectedImport = imports.find((item) => item.id === selectedImportId);

  return (
    <>
      <FlatList
        contentContainerStyle={styles.content}
        data={visibleLogs}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              message={
                selectedImport
                  ? "File này chưa có cây nào được chụp ảnh và xác nhận nhập kho."
                  : "Ảnh chụp khi xác nhận cây về kho sẽ xuất hiện tại đây."
              }
              title={
                selectedImport
                  ? "File chưa có cây đã nhập"
                  : "Chưa có cây nào nhập kho"
              }
            />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={screenText.title}>Nhập kho</Text>
            <View style={styles.importPickerHeader}>
              <Text style={screenText.sectionTitle}>Chọn file hàng</Text>
              <Text style={styles.importPickerCount}>{imports.length + " file"}</Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.importPickerRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <ImportFilterCard
                active={selectedImportId === "all"}
                label="Tất cả file"
                onPress={() => setSelectedImportId("all")}
                pending={summary?.pendingLogs ?? 0}
                received={summary?.receivedLogs ?? 0}
              />
              {imports.map((item) => (
                <ImportFilterCard
                  active={selectedImportId === item.id}
                  key={item.id}
                  label={importDisplayName(item)}
                  onPress={() => setSelectedImportId(item.id)}
                  pending={item.pendingLogs}
                  received={item.receivedLogs}
                />
              ))}
            </ScrollView>
            <View style={styles.summaryBand}>
              <SummaryMetric
                label="Cây đã nhập"
                value={summary?.receivedLogs ?? 0}
              />
              <SummaryMetric
                label="Ảnh đã lưu"
                value={summary?.photoCount ?? 0}
              />
              <SummaryMetric
                label="Còn chờ"
                value={summary?.pendingLogs ?? 0}
              />
            </View>
            {error ? (
              <Notice title="Không tải được dữ liệu" tone="error">
                {error}
              </Notice>
            ) : null}
            <Text style={styles.resultText}>
              {selectedImport
                ? selectedImport.receivedLogs +
                  " cây đã nhập trong " +
                  importDisplayName(selectedImport)
                : (summary?.receivedLogs ?? 0) +
                  " cây trong " +
                  (summary?.totalImports ?? 0) +
                  " danh sách"}
            </Text>
          </View>
        }
        onRefresh={loadOverview}
        refreshing={loading}
        renderItem={({ item }) => (
          <WarehouseRow log={item} onPress={() => openLog(item)} />
        )}
      />

      <Modal
        animationType="slide"
        onRequestClose={closeLog}
        transparent
        visible={selectedLog !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Đóng thư viện ảnh"
            onPress={closeLog}
            style={StyleSheet.absoluteFill}
          />
          {selectedLog ? (
            <View style={styles.detailSheet}>
              <View style={styles.detailHandle} />
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <Text style={styles.detailListCode} numberOfLines={1}>
                    {selectedLog.listCode}
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.detailLogNo}
                  >
                    {selectedLog.logNo}
                  </Text>
                </View>
                <IconButton icon={X} label="Đóng" onPress={closeLog} />
              </View>

              <ScrollView
                contentContainerStyle={styles.detailContent}
                showsVerticalScrollIndicator={false}
              >
                {currentPhotoId ? (
                  <PhotoImage
                    accessibilityLabel={"Ảnh cây " + selectedLog.logNo}
                    photoId={currentPhotoId}
                    resizeMode="contain"
                    style={styles.mainPhoto}
                  />
                ) : (
                  <View style={styles.mainPhotoPlaceholder}>
                    <Images color={colors.muted} size={34} />
                    <Text style={styles.placeholderText}>Chưa có ảnh</Text>
                  </View>
                )}

                <View style={styles.photoMetaBand}>
                  <View style={styles.photoMetaItem}>
                    <CheckCircle2 color={colors.primary} size={18} />
                    <Text style={styles.photoMetaText}>Đã nhập kho</Text>
                  </View>
                  <View style={styles.photoMetaItem}>
                    <Camera color={colors.blue} size={18} />
                    <Text style={styles.photoMetaText}>
                      {selectedLog.photoCount + " ảnh"}
                    </Text>
                  </View>
                </View>
                <View style={styles.intakeMetaBand}>
                  <View style={styles.intakeMetaRow}>
                    <CarFront color={colors.primary} size={17} />
                    <Text style={styles.intakeMetaLabel}>Biển số xe</Text>
                    <Text style={styles.intakeMetaValue} numberOfLines={1}>
                      {selectedLog.vehiclePlate || "--"}
                    </Text>
                  </View>
                  <View style={styles.intakeMetaRow}>
                    <Clock3 color={colors.blue} size={17} />
                    <Text style={styles.intakeMetaLabel}>Thời gian nhập</Text>
                    <Text style={styles.intakeMetaValue} numberOfLines={1}>
                      {formatIntakeTime(selectedLog.receivedAt)}
                    </Text>
                  </View>
                </View>

                {loadingPhotos ? (
                  <View style={styles.loadingPhotos}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null}
                {photoError ? (
                  <Notice title="Không tải được ảnh" tone="error">
                    {photoError}
                  </Notice>
                ) : null}

                {photos.length > 0 ? (
                  <>
                    <Text style={screenText.sectionTitle}>Tất cả ảnh</Text>
                    <ScrollView
                      contentContainerStyle={styles.thumbnailRow}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {photos.map((photo, index) => {
                        const active = photo.id === currentPhotoId;

                        return (
                          <Pressable
                            accessibilityLabel={"Xem ảnh " + (index + 1)}
                            key={photo.id}
                            onPress={() => setSelectedPhotoId(photo.id)}
                            style={[
                              styles.thumbnailButton,
                              active && styles.thumbnailButtonActive
                            ]}
                          >
                            <PhotoImage
                              accessibilityLabel={"Ảnh " + (index + 1)}
                              photoId={photo.id}
                              style={styles.thumbnail}
                            />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.selectedPhotoMeta}>
                      <Text style={styles.capturedText} numberOfLines={1}>
                        {photos.find((photo) => photo.id === currentPhotoId)
                          ?.vehiclePlate || "Chưa có biển số"}
                      </Text>
                      <Text style={styles.capturedText} numberOfLines={1}>
                        {formatIntakeTime(
                          photos.find((photo) => photo.id === currentPhotoId)
                            ?.capturedAt
                        )}
                      </Text>
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function ImportFilterCard({
  label,
  received,
  pending,
  active,
  onPress
}: {
  label: string;
  received: number;
  pending: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.importFilterCard,
        active && styles.importFilterCardActive,
        { opacity: pressed ? 0.8 : 1 }
      ]}
    >
      <View style={styles.importFilterTitleRow}>
        <FileSpreadsheet
          color={active ? colors.primary : colors.muted}
          size={18}
        />
        <Text
          numberOfLines={2}
          style={[
            styles.importFilterTitle,
            active && styles.importFilterTitleActive
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.importFilterStats}>
        <View style={styles.importFilterStat}>
          <Text style={styles.importFilterValue}>{received}</Text>
          <Text style={styles.importFilterLabel}>Đã nhập</Text>
        </View>
        <View style={styles.importFilterDivider} />
        <View style={styles.importFilterStat}>
          <Text style={styles.importFilterValue}>{pending}</Text>
          <Text style={styles.importFilterLabel}>Còn lại</Text>
        </View>
      </View>
    </Pressable>
  );
}

function importDisplayName(item: WoodImport): string {
  return item.shipmentType === "container"
    ? item.lotName || item.listCode
    : item.vesselName || item.listCode;
}

function WarehouseRow({
  log,
  onPress
}: {
  log: WoodLog;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.warehouseRow,
        { opacity: pressed ? 0.82 : 1 }
      ]}
    >
      {log.latestPhotoId ? (
        <PhotoImage
          accessibilityLabel={"Ảnh cây " + log.logNo}
          photoId={log.latestPhotoId}
          resizeMode="cover"
          style={styles.rowPhoto}
        />
      ) : (
        <View style={styles.rowPhotoPlaceholder}>
          <Images color={colors.muted} size={27} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowListCode} numberOfLines={1}>
          {log.listCode}
        </Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.rowLogNo}>
          {log.logNo}
        </Text>
        <View style={styles.rowMeta}>
          <Camera color={colors.primary} size={14} />
          <Text style={styles.rowMetaText}>{log.photoCount + " ảnh"}</Text>
          <Text style={styles.rowMetaDivider}>·</Text>
          <CarFront color={colors.primary} size={14} />
          <Text style={styles.rowMetaText} numberOfLines={1}>
            {log.vehiclePlate || "Chưa có biển số"}
          </Text>
        </View>
        <Text style={styles.rowDate} numberOfLines={1}>
          {formatIntakeTime(log.receivedAt)}
        </Text>
      </View>
      <ChevronRight color={colors.muted} size={22} />
    </Pressable>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError || caught instanceof Error
    ? caught.message
    : fallback;
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
  importPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  importPickerCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  importPickerRow: {
    gap: 9,
    paddingRight: 12
  },
  importFilterCard: {
    width: 198,
    height: 108,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 11,
    backgroundColor: colors.surface
  },
  importFilterCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  importFilterTitleRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7
  },
  importFilterTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: 0
  },
  importFilterTitleActive: {
    color: colors.primary
  },
  importFilterStats: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center"
  },
  importFilterStat: {
    flex: 1,
    minWidth: 0
  },
  importFilterDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
    backgroundColor: colors.border
  },
  importFilterValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
  },
  importFilterLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0
  },
  separator: {
    height: 10
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
    minWidth: 0,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0
  },
  resultText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  warehouseRow: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    ...shadows.card
  },
  rowPhoto: {
    width: 104,
    height: 96,
    borderRadius: 6,
    backgroundColor: colors.border
  },
  rowPhotoPlaceholder: {
    width: 104,
    height: 96,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rowListCode: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0
  },
  rowLogNo: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4
  },
  rowMetaText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  rowMetaDivider: {
    color: colors.border,
    fontSize: 12,
    letterSpacing: 0
  },
  rowDate: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 27, 21, 0.48)"
  },
  detailSheet: {
    maxHeight: "92%",
    minHeight: "70%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingTop: 8
  },
  detailHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.border
  },
  detailHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  detailIdentity: {
    flex: 1,
    minWidth: 0
  },
  detailListCode: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  detailLogNo: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0
  },
  detailContent: {
    gap: 14,
    padding: 16,
    paddingBottom: 28
  },
  mainPhoto: {
    width: "100%",
    height: 310,
    borderRadius: 7,
    backgroundColor: colors.background
  },
  mainPhotoPlaceholder: {
    width: "100%",
    height: 250,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0
  },
  photoMetaBand: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  photoMetaItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  photoMetaText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  intakeMetaBand: {
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  intakeMetaRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  intakeMetaLabel: {
    width: 92,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  intakeMetaValue: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  },
  loadingPhotos: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center"
  },
  thumbnailRow: {
    gap: 9,
    paddingRight: 12
  },
  thumbnailButton: {
    width: 78,
    height: 78,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 2
  },
  thumbnailButtonActive: {
    borderColor: colors.primary
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 4,
    backgroundColor: colors.background
  },
  capturedText: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  selectedPhotoMeta: {
    flexDirection: "row",
    gap: 12
  }
});
