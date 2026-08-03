import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  Camera,
  Images,
  Maximize2,
  Pencil,
  Trash2,
  X
} from "lucide-react-native";
import {
  ActionButton,
  IconButton,
  Notice,
  screenText,
  StatusBadge
} from "./components";
import { PhotoImage } from "./PhotoImage";
import { colors } from "./theme";
import type { WoodLog, WoodLogPhoto } from "./types";

export function LogPhotoManager({
  log,
  photos,
  selectedPhotoId,
  loading,
  photoError,
  notice,
  busyAction,
  photoRevision,
  fullPhotoId,
  onClose,
  onSelectPhoto,
  onAdd,
  onReplace,
  onDelete,
  onOpenFullPhoto,
  onCloseFullPhoto
}: {
  log: WoodLog | null;
  photos: WoodLogPhoto[];
  selectedPhotoId: string | null;
  loading: boolean;
  photoError: string | null;
  notice: string | null;
  busyAction: "add" | "replace" | "delete" | null;
  photoRevision: number;
  fullPhotoId: string | null;
  onClose: () => void;
  onSelectPhoto: (photoId: string) => void;
  onAdd: () => void;
  onReplace: () => void;
  onDelete: () => void;
  onOpenFullPhoto: (photoId: string) => void;
  onCloseFullPhoto: () => void;
}) {
  const currentPhotoId = selectedPhotoId ?? log?.latestPhotoId ?? null;

  return (
    <>
      <Modal
        animationType="slide"
        onRequestClose={onClose}
        transparent
        visible={log !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Đóng chi tiết cây gỗ"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          {log ? (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIdentity}>
                  <Text style={styles.listCode} numberOfLines={1}>
                    {log.listCode}
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.logNo}
                  >
                    {log.logNo}
                  </Text>
                </View>
                <StatusBadge status={log.status} />
                <IconButton icon={X} label="Đóng" onPress={onClose} />
              </View>

              <ScrollView
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
              >
                {currentPhotoId ? (
                  <Pressable
                    accessibilityLabel="Xem ảnh toàn màn hình"
                    onPress={() => onOpenFullPhoto(currentPhotoId)}
                    style={styles.mainPhotoButton}
                  >
                    <PhotoImage
                      accessibilityLabel={"Ảnh cây " + log.logNo}
                      photoId={currentPhotoId}
                      resizeMode="contain"
                      revision={photoRevision}
                      style={styles.mainPhoto}
                    />
                    <View style={styles.expandIcon}>
                      <Maximize2 color={colors.surface} size={19} />
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Images color={colors.muted} size={34} />
                    <Text style={styles.placeholderText}>Chưa có ảnh</Text>
                  </View>
                )}

                <View style={styles.detailBand}>
                  <DetailMetric label="Loại gỗ" value={log.cargo || "--"} />
                  <DetailMetric
                    label="Kích thước"
                    value={
                      formatMetric(log.lengthM, "m") +
                      " × " +
                      formatMetric(log.diameterCm, "cm")
                    }
                  />
                  <DetailMetric
                    label="Thể tích"
                    value={formatMetric(log.volumeCbm, "CBM")}
                  />
                  <DetailMetric label="Ảnh" value={log.photoCount + " ảnh"} />
                </View>

                {loading ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null}
                {photoError ? (
                  <Notice title="Không thể quản lý ảnh" tone="error">
                    {photoError}
                  </Notice>
                ) : null}
                {notice ? (
                  <Notice title="Đã cập nhật" tone="success">
                    {notice}
                  </Notice>
                ) : null}

                {photos.length > 0 ? (
                  <>
                    <Text style={screenText.sectionTitle}>Ảnh của cây</Text>
                    <ScrollView
                      contentContainerStyle={styles.thumbnailRow}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {photos.map((photo, index) => {
                        const active = photo.id === currentPhotoId;

                        return (
                          <Pressable
                            accessibilityLabel={"Chọn ảnh " + (index + 1)}
                            key={photo.id}
                            onPress={() => onSelectPhoto(photo.id)}
                            style={[
                              styles.thumbnailButton,
                              active && styles.thumbnailButtonActive
                            ]}
                          >
                            <PhotoImage
                              accessibilityLabel={"Ảnh " + (index + 1)}
                              photoId={photo.id}
                              revision={photoRevision}
                              style={styles.thumbnail}
                            />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}

                <ActionButton
                  busy={busyAction === "add"}
                  disabled={busyAction !== null}
                  icon={Camera}
                  label={log.photoCount > 0 ? "Chụp thêm ảnh" : "Chụp ảnh nhập kho"}
                  onPress={onAdd}
                />
                {currentPhotoId ? (
                  <View style={styles.actionRow}>
                    <ActionButton
                      busy={busyAction === "replace"}
                      disabled={busyAction !== null}
                      icon={Pencil}
                      label="Thay ảnh"
                      onPress={onReplace}
                      style={styles.actionButton}
                      variant="secondary"
                    />
                    <ActionButton
                      busy={busyAction === "delete"}
                      disabled={busyAction !== null}
                      icon={Trash2}
                      label="Xóa ảnh"
                      onPress={onDelete}
                      style={styles.actionButton}
                      variant="danger"
                    />
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={onCloseFullPhoto}
        transparent
        visible={fullPhotoId !== null}
      >
        <View style={styles.fullPhotoBackdrop}>
          {fullPhotoId && log ? (
            <PhotoImage
              accessibilityLabel={"Ảnh lớn cây " + log.logNo}
              photoId={fullPhotoId}
              resizeMode="contain"
              revision={photoRevision}
              style={styles.fullPhoto}
            />
          ) : null}
          <Pressable
            accessibilityLabel="Đóng ảnh lớn"
            onPress={onCloseFullPhoto}
            style={styles.fullPhotoClose}
          >
            <X color={colors.surface} size={27} />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null
    ? "--"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value) +
        " " +
        suffix;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 27, 21, 0.48)"
  },
  sheet: {
    maxHeight: "94%",
    minHeight: "72%",
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.border
  },
  sheetHeader: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sheetIdentity: {
    flex: 1,
    minWidth: 0
  },
  listCode: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  logNo: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0
  },
  sheetContent: {
    gap: 13,
    padding: 16,
    paddingBottom: 28
  },
  mainPhotoButton: {
    width: "100%",
    height: 290,
    position: "relative"
  },
  mainPhoto: {
    width: "100%",
    height: 290,
    borderRadius: 7,
    backgroundColor: colors.background
  },
  expandIcon: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(17, 27, 21, 0.76)"
  },
  photoPlaceholder: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.background
  },
  placeholderText: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0
  },
  detailBand: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  detailRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  detailLabel: {
    width: 86,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    letterSpacing: 0
  },
  loading: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center"
  },
  thumbnailRow: {
    gap: 8,
    paddingRight: 12
  },
  thumbnailButton: {
    width: 78,
    height: 78,
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 7
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
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    flex: 1,
    minWidth: 0
  },
  fullPhotoBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.94)"
  },
  fullPhoto: {
    width: "100%",
    height: "100%"
  },
  fullPhotoClose: {
    position: "absolute",
    top: 36,
    right: 16,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: "rgba(0, 0, 0, 0.64)"
  }
});
