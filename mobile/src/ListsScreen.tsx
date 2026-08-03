import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue
} from "react-native";
import * as ExpoImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  ChevronRight,
  Container,
  PackageOpen,
  Search,
  X
} from "lucide-react-native";
import {
  ApiError,
  deleteLogPhoto,
  getLogPhotos,
  getImportLogs,
  getImports,
  replaceLogPhoto,
  uploadLogPhoto
} from "./api";
import {
  EmptyState,
  IconButton,
  LogCard,
  Notice,
  screenText
} from "./components";
import { LogPhotoManager } from "./LogPhotoManager";
import {
  removeStoredPhoto,
  storeCapturedPhoto
} from "./PhotoImage";
import { colors, shadows } from "./theme";
import type {
  LogStatus,
  PhotoFile,
  WoodImport,
  WoodLog,
  WoodLogPhoto
} from "./types";

type Filter = "all" | LogStatus;

export function ListsScreen({
  refreshKey,
  onDataChanged
}: {
  refreshKey: number;
  onDataChanged: () => void;
}) {
  const [imports, setImports] = useState<WoodImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<WoodImport | null>(null);
  const [logs, setLogs] = useState<WoodLog[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [woodType, setWoodType] = useState("all");
  const [logQuery, setLogQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WoodLog | null>(null);
  const [photos, setPhotos] = useState<WoodLogPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [busyPhotoAction, setBusyPhotoAction] = useState<
    "add" | "replace" | "delete" | null
  >(null);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [fullPhotoId, setFullPhotoId] = useState<string | null>(null);

  useEffect(() => {
    loadImports();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedImport) {
      loadLogs(selectedImport);
    }
  }, [selectedImport?.id, refreshKey]);

  const woodTypes = useMemo(() => {
    const values = Array.from(
        new Set(
          logs
            .map((log) => log.cargo?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right, "vi"));

    return values.length > 0
      ? values
      : selectedImport?.woodSpecies
        ? [selectedImport.woodSpecies]
        : [];
  }, [logs, selectedImport?.woodSpecies]);

  const visibleLogs = useMemo(() => {
    const query = normalizeSearch(logQuery);

    return logs.filter((log) => {
      const matchesStatus = filter === "all" || log.status === filter;
      const matchesWood =
        woodType === "all" ||
        log.cargo?.trim() === woodType ||
        (!log.cargo && selectedImport?.woodSpecies === woodType);
      const matchesQuery = !query || normalizeSearch(log.logNo).includes(query);
      return matchesStatus && matchesWood && matchesQuery;
    });
  }, [filter, logQuery, logs, selectedImport?.woodSpecies, woodType]);

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

  async function syncImports() {
    try {
      const next = await getImports();
      setImports(next);
      setSelectedImport((current) =>
        current ? next.find((item) => item.id === current.id) ?? null : null
      );
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function loadLogs(item: WoodImport) {
    setLoading(true);
    setError(null);

    try {
      setLogs(await getImportLogs(item.id));
    } catch (caught) {
      setLogs([]);
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function openImport(item: WoodImport) {
    setSelectedImport(item);
    setFilter("all");
    setWoodType("all");
    setLogQuery("");
    setError(null);
  }

  async function openLog(log: WoodLog) {
    setSelectedLog(log);
    setPhotos([]);
    setSelectedPhotoId(log.latestPhotoId);
    setPhotoError(null);
    setPhotoNotice(null);
    setLoadingPhotos(true);

    try {
      const next = await getLogPhotos(log.id);
      setPhotos(next);
      setSelectedPhotoId(log.latestPhotoId ?? next[0]?.id ?? null);
    } catch (caught) {
      setPhotoError(errorMessage(caught));
    } finally {
      setLoadingPhotos(false);
    }
  }

  function closeLog() {
    setSelectedLog(null);
    setPhotos([]);
    setSelectedPhotoId(null);
    setPhotoError(null);
    setPhotoNotice(null);
    setFullPhotoId(null);
  }

  async function prepareCameraPhoto(log: WoodLog): Promise<PhotoFile | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Chưa có quyền camera",
        "Hãy cấp quyền camera trong cài đặt Android để chụp cây gỗ."
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    const context = ExpoImageManipulator.ImageManipulator.manipulate(asset.uri);

    if (asset.width > 1600) {
      context.resize({ width: 1600, height: null });
    }

    const rendered = await context.renderAsync();
    const compressed = await rendered.saveAsync({
      format: ExpoImageManipulator.SaveFormat.JPEG,
      compress: 0.72
    });

    return {
      uri: compressed.uri,
      name: "log-" + log.id + "-" + Date.now() + ".jpg",
      mimeType: "image/jpeg"
    };
  }

  function updateLogPhotoState(
    logId: string,
    change: Pick<WoodLog, "status" | "photoCount" | "latestPhotoId"> & {
      receivedAt: string | null;
    }
  ) {
    setLogs((current) =>
      current.map((log) => (log.id === logId ? { ...log, ...change } : log))
    );
    setSelectedLog((current) =>
      current?.id === logId ? { ...current, ...change } : current
    );
  }

  async function refreshPhotos(logId: string, preferredId: string | null) {
    const next = await getLogPhotos(logId);
    setPhotos(next);
    setSelectedPhotoId(
      preferredId && next.some((photo) => photo.id === preferredId)
        ? preferredId
        : next[0]?.id ?? null
    );
  }

  async function capturePhoto(mode: "add" | "replace") {
    const log = selectedLog;
    const replacingPhotoId = selectedPhotoId;

    if (!log || (mode === "replace" && !replacingPhotoId)) {
      return;
    }

    setBusyPhotoAction(mode);
    setPhotoError(null);
    setPhotoNotice(null);

    try {
      const photo = await prepareCameraPhoto(log);

      if (!photo) {
        return;
      }

      const result =
        mode === "replace" && replacingPhotoId
          ? await replaceLogPhoto(replacingPhotoId, photo)
          : await uploadLogPhoto(log.id, photo);

      try {
        await storeCapturedPhoto(result.photoId, photo.uri);
      } catch (caught) {
        removeStoredPhoto(result.photoId);
        console.warn("Captured photo could not be copied to app storage", caught);
      }
      setPhotoRevision((current) => current + 1);
      setSelectedPhotoId(result.photoId);
      updateLogPhotoState(log.id, {
        status: "received",
        receivedAt: log.receivedAt ?? new Date().toISOString(),
        photoCount: result.photoCount,
        latestPhotoId: result.latestPhotoId ?? result.photoId
      });
      try {
        await refreshPhotos(log.id, result.photoId);
      } catch (caught) {
        console.warn("Photo list could not be refreshed", caught);
        setPhotoError("Ảnh đã lưu nhưng chưa tải lại được toàn bộ thư viện.");
      }
      setPhotoNotice(mode === "replace" ? "Đã thay ảnh." : "Đã lưu ảnh nhập kho.");
      await syncImports();
      onDataChanged();
    } catch (caught) {
      setPhotoError(errorMessage(caught));
    } finally {
      setBusyPhotoAction(null);
    }
  }

  function confirmDeletePhoto() {
    if (!selectedPhotoId || !selectedLog) {
      return;
    }

    Alert.alert(
      "Xóa ảnh cây gỗ?",
      "Ảnh sẽ bị xóa khỏi ứng dụng và database. Thao tác này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa ảnh",
          style: "destructive",
          onPress: () => {
            performDeletePhoto().catch((caught) => {
              setPhotoError(errorMessage(caught));
            });
          }
        }
      ]
    );
  }

  async function performDeletePhoto() {
    const photoId = selectedPhotoId;
    const log = selectedLog;

    if (!photoId || !log) {
      return;
    }

    setBusyPhotoAction("delete");
    setPhotoError(null);
    setPhotoNotice(null);

    try {
      const result = await deleteLogPhoto(photoId);
      removeStoredPhoto(photoId);
      setFullPhotoId(null);
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setSelectedPhotoId(result.latestPhotoId);
      updateLogPhotoState(log.id, {
        status: result.status,
        receivedAt: result.status === "received" ? log.receivedAt : null,
        photoCount: result.photoCount,
        latestPhotoId: result.latestPhotoId
      });
      try {
        await refreshPhotos(log.id, result.latestPhotoId);
      } catch (caught) {
        console.warn("Photo list could not be refreshed", caught);
        setPhotoError("Ảnh đã xóa nhưng chưa tải lại được toàn bộ thư viện.");
      }
      setPhotoNotice(
        result.photoCount > 0
          ? "Đã xóa ảnh."
          : "Đã xóa ảnh cuối cùng; cây trở lại trạng thái chờ."
      );
      await syncImports();
      onDataChanged();
    } catch (caught) {
      setPhotoError(errorMessage(caught));
    } finally {
      setBusyPhotoAction(null);
    }
  }

  if (selectedImport) {
    const displayName = importDisplayName(selectedImport);

    return (
      <>
        <FlatList
        data={visibleLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={loading}
        onRefresh={() => loadLogs(selectedImport)}
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
                  setWoodType("all");
                  setLogQuery("");
                }}
              />
              <View style={styles.detailIdentity}>
                <Text style={styles.detailCode} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.detailFile} numberOfLines={1}>
                  {displayName !== selectedImport.listCode
                    ? selectedImport.listCode + " · "
                    : ""}
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
            <View style={styles.logSearchRow}>
              <Search color={colors.muted} size={19} />
              <TextInput
                accessibilityLabel="Tìm số Log trong file"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setLogQuery}
                placeholder="Tìm số Log trong file"
                placeholderTextColor={colors.disabled}
                style={styles.logSearchInput}
                value={logQuery}
              />
              {logQuery ? (
                <IconButton
                  icon={X}
                  label="Xóa số Log đang tìm"
                  onPress={() => setLogQuery("")}
                />
              ) : null}
            </View>
            <WoodTypeFilter
              onChange={setWoodType}
              options={woodTypes}
              value={woodType}
            />
            <SegmentedFilter value={filter} onChange={setFilter} />
            {error ? (
              <Notice title="Không tải được dữ liệu" tone="error">
                {error}
              </Notice>
            ) : null}
            <Text style={styles.resultText}>
              {visibleLogs.length + " / " + logs.length + " cây"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? <EmptyState title="Không có cây phù hợp bộ lọc" /> : null
        }
        renderItem={({ item }) => (
          <LogCard log={item} onPress={() => openLog(item)} />
        )}
        />
        <LogPhotoManager
        busyAction={busyPhotoAction}
        fullPhotoId={fullPhotoId}
        loading={loadingPhotos}
        log={selectedLog}
        notice={photoNotice}
        onAdd={() => capturePhoto("add")}
        onClose={closeLog}
        onCloseFullPhoto={() => setFullPhotoId(null)}
        onDelete={confirmDeletePhoto}
        onOpenFullPhoto={setFullPhotoId}
        onReplace={() => capturePhoto("replace")}
        onSelectPhoto={setSelectedPhotoId}
        photoError={photoError}
        photoRevision={photoRevision}
        photos={photos}
        selectedPhotoId={selectedPhotoId}
        />
      </>
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
        <ImportRow item={item} onPress={() => openImport(item)} />
      )}
    />
  );
}

function WoodTypeFilter({
  value,
  options,
  onChange
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.woodFilterGroup}>
      <Text style={styles.filterLabel}>Loại gỗ</Text>
      <ScrollView
        contentContainerStyle={styles.woodFilterRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {["all", ...options].map((option) => {
          const active = option === value;

          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={[
                styles.woodFilterOption,
                active && styles.woodFilterOptionActive
              ]}
            >
              <Text
                style={[
                  styles.woodFilterText,
                  active && styles.woodFilterTextActive
                ]}
              >
                {option === "all" ? "Tất cả loại gỗ" : option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
  const displayName = importDisplayName(item);

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
          {displayName}
        </Text>
        <Text style={styles.importMeta} numberOfLines={1}>
          {item.shipmentType === "container"
            ? item.listCode +
              " · " +
              item.container20Count +
              " Cont 20' · " +
              item.container40Count +
              " Cont 40'"
            : item.listCode + " · Hàng rời"}
        </Text>
        <Text style={styles.importMeta} numberOfLines={1}>
          {(item.ownerName || "--") + " · " + (item.contactPhone || "--")}
        </Text>
        <Text style={styles.importMeta} numberOfLines={2}>
          {(item.woodSpecies || "--") +
            " · Nơi lấy: " +
            (item.shipmentType === "container"
              ? item.containerPickupLocation || "--"
              : item.woodPickupLocation || "--")}
        </Text>
        <Text style={styles.importMeta} numberOfLines={1}>
          {formatImportDate(item.intakeStartDate) +
            " · Tổng " +
            formatImportQuantity(item)}
        </Text>
        <Text style={styles.importProgressText}>
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
        <Text style={styles.shipmentHeading}>Thông tin lô hàng</Text>
        <ShipmentRow
          label="Chủ hàng"
          value={(item.ownerName || "--") + " · " + (item.contactPhone || "--")}
        />
        <ShipmentRow label="Tên tàu" value={item.vesselName || "--"} />
        <ShipmentRow label="Gỗ" value={item.woodSpecies || "--"} />
        <ShipmentRow
          label="Nơi lấy gỗ"
          value={item.woodPickupLocation || "--"}
        />
        <ShipmentRow
          label="Ngày bắt đầu"
          value={formatImportDate(item.intakeStartDate)}
        />
        <ShipmentRow
          label="Tổng lô"
          value={formatImportQuantity(item)}
        />
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
      <ShipmentRow label="Tên lô" value={item.lotName || "--"} />
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
        value={formatImportQuantity(item)}
      />
    </View>
  );
}

function importDisplayName(item: WoodImport): string {
  return item.shipmentType === "container"
    ? item.lotName || item.listCode
    : item.vesselName || item.listCode;
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

function formatImportQuantity(item: WoodImport): string {
  return item.totalQuantity !== null && item.quantityUnit
    ? item.totalQuantity + " " + quantityUnitLabel(item.quantityUnit)
    : "--";
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null
    ? "--"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value) +
        " " +
        suffix;
}

function normalizeSearch(value: string): string {
  return value.toLocaleUpperCase("vi-VN").replace(/[\s._/-]+/g, "");
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
    minHeight: 154,
    flexDirection: "row",
    alignItems: "flex-start",
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
    justifyContent: "center",
    marginTop: 2
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
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0
  },
  importProgressText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
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
  logSearchRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 13,
    paddingRight: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.surface
  },
  logSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0
  },
  woodFilterGroup: {
    gap: 6
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  woodFilterRow: {
    gap: 7,
    paddingRight: 14
  },
  woodFilterOption: {
    minHeight: 38,
    maxWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface
  },
  woodFilterOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  woodFilterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  woodFilterTextActive: {
    color: colors.primary,
    fontWeight: "900"
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
