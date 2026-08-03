import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Images,
  X
} from "lucide-react-native";
import {
  apiHeaders,
  ApiError,
  getLogPhotos,
  getWarehouse,
  photoUrl
} from "./api";
import {
  EmptyState,
  IconButton,
  Notice,
  screenText
} from "./components";
import { colors, shadows } from "./theme";
import type {
  WarehouseOverview,
  WoodLog,
  WoodLogPhoto
} from "./types";

export function WarehouseScreen({ refreshKey }: { refreshKey: number }) {
  const [overview, setOverview] = useState<WarehouseOverview | null>(null);
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
      setOverview(await getWarehouse());
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

  return (
    <>
      <FlatList
        contentContainerStyle={styles.content}
        data={logs}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              message="Ảnh chụp khi xác nhận cây về kho sẽ xuất hiện tại đây."
              title="Chưa có cây nào nhập kho"
            />
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={screenText.title}>Nhập kho</Text>
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
              {(summary?.receivedLogs ?? 0) + " cây trong " +
                (summary?.totalImports ?? 0) + " danh sách"}
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
                  <Image
                    accessibilityLabel={"Ảnh cây " + selectedLog.logNo}
                    resizeMode="contain"
                    source={{
                      uri: photoUrl(currentPhotoId),
                      headers: apiHeaders()
                    }}
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
                            <Image
                              source={{
                                uri: photoUrl(photo.id),
                                headers: apiHeaders()
                              }}
                              style={styles.thumbnail}
                            />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.capturedText}>
                      {formatCapturedAt(
                        photos.find((photo) => photo.id === currentPhotoId)
                          ?.capturedAt
                      )}
                    </Text>
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
        <Image
          accessibilityLabel={"Ảnh cây " + log.logNo}
          resizeMode="cover"
          source={{
            uri: photoUrl(log.latestPhotoId),
            headers: apiHeaders()
          }}
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
        </View>
        <Text style={styles.rowDate} numberOfLines={1}>
          {formatCapturedAt(log.receivedAt)}
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

function formatCapturedAt(value?: string | null): string {
  if (!value) {
    return "Chưa có thời gian chụp";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có thời gian chụp";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
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
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
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
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  }
});
