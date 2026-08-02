import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  FileSpreadsheet,
  RefreshCw,
  Upload,
  X
} from "lucide-react-native";
import {
  ApiError,
  getImports,
  importWorkbook
} from "./api";
import {
  ActionButton,
  EmptyState,
  IconButton,
  Notice,
  screenText
} from "./components";
import { colors, shadows } from "./theme";
import type { WoodImport } from "./types";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function ImportScreen({
  onImported
}: {
  onImported: () => void;
}) {
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null
  );
  const [imports, setImports] = useState<WoodImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadImports();
  }, []);

  function errorMessage(caught: unknown): string {
    return caught instanceof ApiError || caught instanceof Error
      ? caught.message
      : "Không thể hoàn tất thao tác.";
  }

  async function loadImports() {
    setRefreshing(true);

    try {
      setImports(await getImports());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRefreshing(false);
    }
  }

  async function pickWorkbook() {
    setError(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: XLSX_MIME,
      copyToCacheDirectory: true,
      multiple: false
    });

    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
    }
  }

  async function uploadWorkbook() {
    if (!asset) {
      setError("Vui lòng chọn file Excel .xlsx.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await importWorkbook(asset);
      setNotice(
        result.duplicateFile
          ? "File này đã tồn tại: " + result.import.listCode
          : "Đã nhập " +
              result.import.importedRows +
              " cây vào " +
              result.import.listCode +
              "."
      );
      setAsset(null);
      await loadImports();
      onImported();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlatList
      data={imports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={loadImports}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={screenText.title}>Nhập danh sách</Text>
          <Text style={screenText.label}>File Excel (.xlsx)</Text>

          {asset ? (
            <View style={styles.fileCard}>
              <View style={styles.fileIcon}>
                <FileSpreadsheet color={colors.primary} size={25} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {asset.name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatBytes(asset.size ?? 0)}
                </Text>
              </View>
              <IconButton
                icon={X}
                label="Bỏ file đã chọn"
                onPress={() => setAsset(null)}
              />
            </View>
          ) : (
            <ActionButton
              icon={FileSpreadsheet}
              label="Chọn file Excel"
              onPress={pickWorkbook}
              variant="secondary"
            />
          )}

          {asset ? (
            <View style={styles.actionRow}>
              <ActionButton
                icon={RefreshCw}
                label="Chọn lại"
                onPress={pickWorkbook}
                style={styles.rowButton}
                variant="secondary"
              />
              <ActionButton
                busy={loading}
                icon={Upload}
                label="Nhập dữ liệu"
                onPress={uploadWorkbook}
                style={styles.rowButton}
              />
            </View>
          ) : null}

          {error ? (
            <Notice title="Không thể nhập file" tone="error">
              {error}
            </Notice>
          ) : null}
          {notice ? (
            <Notice title="Danh sách đã sẵn sàng" tone="success">
              {notice}
            </Notice>
          ) : null}

          <View style={styles.sectionHeading}>
            <Text style={screenText.sectionTitle}>Danh sách gần đây</Text>
            <Text style={styles.sectionCount}>{imports.length}</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        !refreshing ? (
          <EmptyState title="Chưa có danh sách nào" />
        ) : null
      }
      renderItem={({ item }) => <ImportSummary item={item} />}
    />
  );
}

function ImportSummary({ item }: { item: WoodImport }) {
  const progress =
    item.totalLogs === 0 ? 0 : item.receivedLogs / item.totalLogs;

  return (
    <View style={styles.importCard}>
      <View style={styles.importTop}>
        <View style={styles.importIdentity}>
          <Text style={styles.importCode} numberOfLines={1}>
            {item.listCode}
          </Text>
          <Text style={styles.importFile} numberOfLines={1}>
            {item.originalFilename}
          </Text>
        </View>
        <Text style={styles.importDate}>
          {new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit"
          }).format(new Date(item.createdAt))}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: (Math.round(progress * 100) + "%") as DimensionValue }
          ]}
        />
      </View>
      <View style={styles.importStats}>
        <Text style={styles.statText}>
          <Text style={styles.statStrong}>{item.receivedLogs}</Text>
          {" đã nhận"}
        </Text>
        <Text style={styles.statText}>
          <Text style={styles.statStrong}>{item.pendingLogs}</Text>
          {" đang chờ"}
        </Text>
        <Text style={styles.statText}>
          {formatVolume(item.totalVolumeCbm)}
        </Text>
      </View>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return "Không rõ dung lượng";
  }

  return bytes < 1024 * 1024
    ? Math.ceil(bytes / 1024) + " KB"
    : (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatVolume(value: number): string {
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value) +
    " CBM"
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
  fileCard: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    ...shadows.card
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  fileInfo: {
    flex: 1,
    minWidth: 0
  },
  fileName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  fileSize: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0
  },
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  rowButton: {
    flex: 1
  },
  sectionHeading: {
    minHeight: 36,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.blueSoft,
    color: colors.blue,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: 0
  },
  separator: {
    height: 10
  },
  importCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    gap: 11,
    ...shadows.card
  },
  importTop: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  importIdentity: {
    flex: 1,
    minWidth: 0
  },
  importCode: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0
  },
  importFile: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  importDate: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  progressTrack: {
    height: 7,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.border
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary
  },
  importStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  statText: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  statStrong: {
    color: colors.ink,
    fontWeight: "800"
  }
});
