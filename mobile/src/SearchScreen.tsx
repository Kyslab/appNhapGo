import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Image as ImageIcon,
  Search,
  X
} from "lucide-react-native";
import {
  ApiError,
  searchLogs,
  uploadLogPhoto
} from "./api";
import {
  ActionButton,
  EmptyState,
  IconButton,
  LogCard,
  Notice,
  screenText,
  StatusBadge
} from "./components";
import { colors } from "./theme";
import { PhotoImage, storeCapturedPhoto } from "./PhotoImage";
import { IntakeInfoModal } from "./IntakeInfoModal";
import {
  formatIntakeTime,
  loadLastVehiclePlate,
  rememberVehiclePlate
} from "./intake";
import type { IntakeDetails, WoodLog } from "./types";

const PENDING_CAMERA_LOG = "appNhapGo.pendingCameraLogId";
const PENDING_CAMERA_CONTEXT = "appNhapGo.pendingCameraContext";

export function SearchScreen({
  onDataChanged
}: {
  onDataChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WoodLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WoodLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyLogId, setBusyLogId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastVehiclePlate, setLastVehiclePlate] = useState("");
  const [captureRequest, setCaptureRequest] = useState<{
    log: WoodLog;
    capturedAt: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function recoverPendingCamera() {
      const [storedContext, legacyLogId] = await Promise.all([
        AsyncStorage.getItem(PENDING_CAMERA_CONTEXT),
        AsyncStorage.getItem(PENDING_CAMERA_LOG)
      ]);
      let context: ({ logId: string } & IntakeDetails) | null = null;

      if (storedContext) {
        try {
          context = JSON.parse(storedContext) as { logId: string } & IntakeDetails;
        } catch {
          context = null;
        }
      }

      const logId = context?.logId ?? legacyLogId;

      if (!logId) {
        return;
      }

      const pending = await ImagePicker.getPendingResultAsync();

      try {
        if (
          pending &&
          "assets" in pending &&
          pending.assets &&
          pending.assets[0]
        ) {
          await saveCapturedPhoto(logId, pending.assets[0], {
            capturedAt: context?.capturedAt ?? new Date().toISOString(),
            vehiclePlate: context?.vehiclePlate ?? ""
          });

          if (active) {
            setNotice("Ảnh camera đã được khôi phục và lưu vào cây gỗ.");
          }
        }
      } catch (caught) {
        if (active) {
          setError(errorMessage(caught));
        }
      } finally {
        await Promise.all([
          AsyncStorage.removeItem(PENDING_CAMERA_LOG),
          AsyncStorage.removeItem(PENDING_CAMERA_CONTEXT)
        ]);
      }
    }

    loadLastVehiclePlate()
      .then((value) => {
        if (active) {
          setLastVehiclePlate(value);
        }
      })
      .catch(() => undefined);

    recoverPendingCamera().catch((caught) => {
      if (active) {
        setError(errorMessage(caught));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function errorMessage(caught: unknown): string {
    return caught instanceof ApiError || caught instanceof Error
      ? caught.message
      : "Không thể hoàn tất thao tác.";
  }

  async function runSearch(value = query) {
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Vui lòng nhập số Log.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setNotice(null);
    setHasSearched(true);

    try {
      setResults(await searchLogs(trimmed));
    } catch (caught) {
      setResults([]);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveCapturedPhoto(
    logId: string,
    asset: ImagePicker.ImagePickerAsset,
    intake: IntakeDetails
  ) {
    const context = ExpoImageManipulator.ImageManipulator.manipulate(asset.uri);

    if (asset.width > 1600) {
      context.resize({ width: 1600, height: null });
    }

    const rendered = await context.renderAsync();
    const compressed = await rendered.saveAsync({
      format: ExpoImageManipulator.SaveFormat.JPEG,
      compress: 0.72
    });
    const response = await uploadLogPhoto(
      logId,
      {
        uri: compressed.uri,
        name: "log-" + logId + "-" + Date.now() + ".jpg",
        mimeType: "image/jpeg"
      },
      intake
    );

    try {
      await storeCapturedPhoto(response.photoId, compressed.uri);
    } catch (caught) {
      console.warn("Captured photo could not be copied to app storage", caught);
    }

    setResults((current) =>
      current.map((log) =>
        log.id === logId
          ? {
              ...log,
              status: "received",
              vehiclePlate: response.vehiclePlate,
              receivedAt: response.receivedAt,
              photoCount: response.photoCount,
              latestPhotoId: response.photoId
            }
          : log
      )
    );
    setSelectedLog((current) =>
      current?.id === logId
        ? {
            ...current,
            status: "received",
            vehiclePlate: response.vehiclePlate,
            receivedAt: response.receivedAt,
            photoCount: response.photoCount,
            latestPhotoId: response.photoId
          }
        : current
    );
    onDataChanged();
  }

  async function capturePhoto(log: WoodLog, intake: IntakeDetails) {
    setBusyLogId(log.id);
    setError(null);
    setNotice(null);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Chưa có quyền camera",
          "Hãy cấp quyền camera trong cài đặt Android để chụp cây gỗ."
        );
        return;
      }

      await Promise.all([
        AsyncStorage.setItem(PENDING_CAMERA_LOG, log.id),
        AsyncStorage.setItem(
          PENDING_CAMERA_CONTEXT,
          JSON.stringify({ logId: log.id, ...intake })
        )
      ]);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85
      });

      if (result.canceled || !result.assets[0]) {
        await Promise.all([
          AsyncStorage.removeItem(PENDING_CAMERA_LOG),
          AsyncStorage.removeItem(PENDING_CAMERA_CONTEXT)
        ]);
        return;
      }

      await saveCapturedPhoto(log.id, result.assets[0], intake);
      await Promise.all([
        AsyncStorage.removeItem(PENDING_CAMERA_LOG),
        AsyncStorage.removeItem(PENDING_CAMERA_CONTEXT)
      ]);
      setNotice("Đã lưu ảnh và xác nhận cây " + log.logNo + " về kho.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyLogId(null);
    }
  }

  function requestCapture(log: WoodLog) {
    setCaptureRequest({ log, capturedAt: new Date().toISOString() });
  }

  function confirmCapture(vehiclePlate: string) {
    const pending = captureRequest;

    if (!pending) {
      return;
    }

    const intake = { vehiclePlate, capturedAt: pending.capturedAt };
    setCaptureRequest(null);
    setLastVehiclePlate(vehiclePlate);
    rememberVehiclePlate(vehiclePlate).catch(() => undefined);
    capturePhoto(pending.log, intake).catch((caught) => {
      setError(errorMessage(caught));
    });
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Text style={screenText.title}>Tra cứu số Log</Text>
            <Text style={screenText.label}>Số Log</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Số Log"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setQuery}
                onSubmitEditing={() => runSearch()}
                placeholder="10224A"
                placeholderTextColor={colors.disabled}
                returnKeyType="search"
                selectTextOnFocus
                style={styles.searchInput}
                value={query}
              />
              <ActionButton
                accessibilityLabel="Tìm số Log"
                busy={loading}
                icon={Search}
                label="Tìm"
                onPress={() => runSearch()}
                style={styles.searchButton}
              />
            </View>
            {error ? (
              <Notice title="Không thể thực hiện" tone="error">
                {error}
              </Notice>
            ) : null}
            {notice ? (
              <Notice title="Đã cập nhật" tone="success">
                {notice}
              </Notice>
            ) : null}
            {results.length > 0 ? (
              <Text style={styles.resultCount}>
                {results.length + " kết quả"}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hasSearched && !loading && !error ? (
            <EmptyState
              title="Không có số Log này"
              message="Số Log không nằm trong các danh sách đã nhập."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <LogCard log={item} onPress={() => setSelectedLog(item)} />
        )}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedLog(null)}
        transparent
        visible={selectedLog !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Đóng chi tiết"
            onPress={() => setSelectedLog(null)}
            style={StyleSheet.absoluteFill}
          />
          {selectedLog ? (
            <View style={styles.detailSheet}>
              <View style={styles.detailHandle} />
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <Text style={styles.detailListCode}>
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
                <IconButton
                  icon={X}
                  label="Đóng"
                  onPress={() => setSelectedLog(null)}
                />
              </View>
              <StatusBadge status={selectedLog.status} />
              <View style={styles.detailTable}>
                <DetailRow label="Loại gỗ" value={selectedLog.cargo || "--"} />
                <DetailRow
                  label="Kích thước"
                  value={
                    metric(selectedLog.lengthM, "m") +
                    " × " +
                    metric(selectedLog.diameterCm, "cm")
                  }
                />
                <DetailRow
                  label="Thể tích"
                  value={metric(selectedLog.volumeCbm, "CBM")}
                />
                <DetailRow
                  label="Ảnh đã lưu"
                  value={String(selectedLog.photoCount)}
                />
                <DetailRow
                  label="Biển số xe"
                  value={selectedLog.vehiclePlate || "--"}
                />
                <DetailRow
                  label="Thời gian nhập"
                  value={formatIntakeTime(selectedLog.receivedAt)}
                />
              </View>

              {selectedLog.latestPhotoId ? (
                <PhotoImage
                  accessibilityLabel={"Ảnh cây " + selectedLog.logNo}
                  photoId={selectedLog.latestPhotoId}
                  resizeMode="cover"
                  style={styles.latestPhoto}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <ImageIcon color={colors.muted} size={28} />
                  <Text style={styles.photoPlaceholderText}>Chưa có ảnh</Text>
                </View>
              )}

              <ActionButton
                busy={busyLogId === selectedLog.id}
                icon={Camera}
                label={
                  selectedLog.photoCount > 0 ? "Chụp thêm ảnh" : "Chụp ảnh cây"
                }
                onPress={() => requestCapture(selectedLog)}
              />
            </View>
          ) : null}
        </View>
      </Modal>
      <IntakeInfoModal
        capturedAt={captureRequest?.capturedAt ?? new Date().toISOString()}
        initialVehiclePlate={
          captureRequest?.log.vehiclePlate || lastVehiclePlate
        }
        onClose={() => setCaptureRequest(null)}
        onConfirm={confirmCapture}
        visible={captureRequest !== null}
      />
    </View>
  );
}

function metric(value: number | null, suffix: string): string {
  return value === null
    ? "--"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value) +
        " " +
        suffix;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24
  },
  headerContent: {
    gap: 12,
    marginBottom: 14
  },
  searchRow: {
    flexDirection: "row",
    gap: 8
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 50,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 14,
    letterSpacing: 0
  },
  searchButton: {
    width: 96
  },
  resultCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  separator: {
    height: 10
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 13, 0.42)",
    justifyContent: "flex-end"
  },
  detailSheet: {
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 22,
    gap: 14
  },
  detailHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  detailHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  detailIdentity: {
    flex: 1,
    minWidth: 0
  },
  detailListCode: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  detailLogNo: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0
  },
  detailTable: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  detailRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0
  },
  detailValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    letterSpacing: 0
  },
  latestPhoto: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 6,
    backgroundColor: colors.background
  },
  photoPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 7,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  photoPlaceholderText: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0
  }
});
