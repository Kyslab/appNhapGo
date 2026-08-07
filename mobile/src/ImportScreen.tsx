import { useEffect, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  Container,
  FileSpreadsheet,
  PackageOpen,
  RefreshCw,
  Upload,
  X
} from "lucide-react-native";
import { ApiError, getImports, importWorkbook } from "./api";
import {
  ActionButton,
  EmptyState,
  IconButton,
  Notice,
  screenText
} from "./components";
import { colors, shadows } from "./theme";
import type {
  ImportDetailsInput,
  QuantityUnit,
  ShipmentType,
  WoodImport
} from "./types";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function emptyDetails(): ImportDetailsInput {
  return {
    shipmentType: null,
    ownerName: "",
    contactPhone: "",
    lotName: "",
    vesselName: "",
    woodSpecies: "",
    container20Count: "",
    container40Count: "",
    containerPickupLocation: "",
    woodPickupLocation: "",
    intakeStartDate: "",
    totalQuantity: "",
    quantityUnit: null,
    declaredVolumeCbm: ""
  };
}

export function ImportScreen({ onImported }: { onImported: () => void }) {
  const [shipmentType, setShipmentType] = useState<ShipmentType | null>(null);
  const [details, setDetails] = useState<ImportDetailsInput>(emptyDetails);
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

  function selectShipmentType(value: ShipmentType | null) {
    setShipmentType(value);
    setDetails((current) => ({ ...current, shipmentType: value }));
    setError(null);
    setNotice(null);
  }

  function updateDetail<Key extends keyof ImportDetailsInput>(
    key: Key,
    value: ImportDetailsInput[Key]
  ) {
    setDetails((current) => ({ ...current, [key]: value }));
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
      const nextAsset = result.assets[0];
      setAsset(nextAsset);
    }
  }

  async function uploadWorkbook() {
    if (!asset) {
      setError("Vui lòng chọn file Excel .xlsx.");
      return;
    }

    const validationError = validateDetails(details);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await importWorkbook(asset, details);
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
      setShipmentType(null);
      setDetails(emptyDetails());
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
      contentContainerStyle={styles.content}
      data={imports}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !refreshing ? <EmptyState title="Chưa có danh sách nào" /> : null
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={screenText.title}>Nhập danh sách</Text>
          <FormSection optional title="Hình thức nhập hàng">
            <ShipmentTypeSelector
              onChange={selectShipmentType}
              value={shipmentType}
            />
          </FormSection>

          <FormSection title="File Excel (.xlsx)">
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
          </FormSection>

          {shipmentType === "container" ? (
            <ContainerForm details={details} onChange={updateDetail} />
          ) : shipmentType === "loose" ? (
            <LooseForm details={details} onChange={updateDetail} />
          ) : (
            <UnclassifiedForm details={details} onChange={updateDetail} />
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
      onRefresh={loadImports}
      refreshing={refreshing}
      renderItem={({ item }) => <ImportSummary item={item} />}
    />
  );
}

function ShipmentTypeSelector({
  value,
  onChange
}: {
  value: ShipmentType | null;
  onChange: (value: ShipmentType | null) => void;
}) {
  const options = [
    { value: "container" as const, label: "Hàng Container", icon: Container },
    { value: "loose" as const, label: "Hàng rời", icon: PackageOpen }
  ];

  return (
    <View style={styles.typeSelector}>
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.typeOption,
              active && styles.typeOptionActive,
              { opacity: pressed ? 0.78 : 1 }
            ]}
          >
            <Icon
              color={active ? colors.primary : colors.muted}
              size={23}
            />
            <Text
              numberOfLines={1}
              style={[styles.typeText, active && styles.typeTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      {value ? (
        <IconButton
          icon={X}
          label="Bỏ chọn hình thức nhập hàng"
          onPress={() => onChange(null)}
        />
      ) : null}
    </View>
  );
}

function UnclassifiedForm({
  details,
  onChange
}: {
  details: ImportDetailsInput;
  onChange: DetailChange;
}) {
  return (
    <>
      <OwnerSection details={details} onChange={onChange} />
      <FormSection optional title="Thông tin lô hàng">
        <FormField
          label="Gỗ"
          onChangeText={(value) => onChange("woodSpecies", value)}
          placeholder="Padouk"
          value={details.woodSpecies}
        />
      </FormSection>
      <ShipmentSummarySection details={details} onChange={onChange} />
    </>
  );
}

function ContainerForm({
  details,
  onChange
}: {
  details: ImportDetailsInput;
  onChange: <Key extends keyof ImportDetailsInput>(
    key: Key,
    value: ImportDetailsInput[Key]
  ) => void;
}) {
  return (
    <>
      <OwnerSection details={details} onChange={onChange} />

      <FormSection optional title="Thông tin lô hàng">
        <FormField
          label="Tên lô hàng"
          onChangeText={(value) => onChange("lotName", value)}
          placeholder="Lô Padouk 01"
          value={details.lotName}
        />
        <FormField
          label="Gỗ loại gì"
          onChangeText={(value) => onChange("woodSpecies", value)}
          placeholder="Padouk"
          value={details.woodSpecies}
        />
        <View style={styles.fieldRow}>
          <FormField
            containerStyle={styles.halfField}
            keyboardType="number-pad"
            label="Số Cont 20'"
            onChangeText={(value) => onChange("container20Count", value)}
            selectTextOnFocus
            value={details.container20Count}
          />
          <FormField
            containerStyle={styles.halfField}
            keyboardType="number-pad"
            label="Số Cont 40'"
            onChangeText={(value) => onChange("container40Count", value)}
            selectTextOnFocus
            value={details.container40Count}
          />
        </View>
        <FormField
          label="Nơi lấy container"
          onChangeText={(value) =>
            onChange("containerPickupLocation", value)
          }
          placeholder="Tên cảng hoặc địa điểm"
          value={details.containerPickupLocation}
        />
      </FormSection>

      <ShipmentSummarySection details={details} onChange={onChange} />
    </>
  );
}

type DetailChange = <Key extends keyof ImportDetailsInput>(
  key: Key,
  value: ImportDetailsInput[Key]
) => void;

function LooseForm({
  details,
  onChange
}: {
  details: ImportDetailsInput;
  onChange: DetailChange;
}) {
  return (
    <>
      <OwnerSection details={details} onChange={onChange} />

      <FormSection optional title="Thông tin lô hàng">
        <FormField
          autoCapitalize="words"
          label="Tên tàu"
          onChangeText={(value) => onChange("vesselName", value)}
          placeholder="Tên tàu vận chuyển"
          value={details.vesselName}
        />
        <FormField
          label="Gỗ"
          onChangeText={(value) => onChange("woodSpecies", value)}
          placeholder="Padouk"
          value={details.woodSpecies}
        />
        <FormField
          label="Nơi lấy gỗ"
          onChangeText={(value) => onChange("woodPickupLocation", value)}
          placeholder="Tên cảng hoặc địa điểm"
          value={details.woodPickupLocation}
        />
      </FormSection>

      <ShipmentSummarySection details={details} onChange={onChange} />
    </>
  );
}

function OwnerSection({
  details,
  onChange
}: {
  details: ImportDetailsInput;
  onChange: DetailChange;
}) {
  return (
    <FormSection optional title="Chủ hàng">
      <FormField
        autoCapitalize="words"
        label="Tên chủ hàng"
        onChangeText={(value) => onChange("ownerName", value)}
        placeholder="Tên cá nhân hoặc công ty"
        value={details.ownerName}
      />
      <FormField
        keyboardType="phone-pad"
        label="Điện thoại liên hệ"
        onChangeText={(value) => onChange("contactPhone", value)}
        placeholder="0901234567"
        value={details.contactPhone}
      />
    </FormSection>
  );
}

function ShipmentSummarySection({
  details,
  onChange
}: {
  details: ImportDetailsInput;
  onChange: DetailChange;
}) {
  return (
    <FormSection optional title="Tổng hợp lô hàng">
      <FormField
        autoCapitalize="none"
        label="Ngày bắt đầu nhập"
        maxLength={10}
        onChangeText={(value) => onChange("intakeStartDate", value)}
        placeholder="YYYY-MM-DD"
        value={details.intakeStartDate}
      />
      <FormField
        keyboardType="number-pad"
        label="Tổng số lượng lô hàng"
        onChangeText={(value) => onChange("totalQuantity", value)}
        placeholder="83"
        value={details.totalQuantity}
      />
      <Text style={styles.fieldLabel}>Đơn vị</Text>
      <QuantityUnitSelector
        onChange={(value) => onChange("quantityUnit", value)}
        value={details.quantityUnit}
      />
      <FormField
        keyboardType="decimal-pad"
        label="Tổng khối lượng (CBM)"
        onChangeText={(value) => onChange("declaredVolumeCbm", value)}
        placeholder="361,955"
        value={details.declaredVolumeCbm}
      />
    </FormSection>
  );
}

function FormSection({
  title,
  optional = false,
  children
}: {
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.formSection}>
      <View style={styles.formSectionHeader}>
        <Text style={styles.formSectionTitle}>{title}</Text>
        {optional ? <Text style={styles.optionalLabel}>Không bắt buộc</Text> : null}
      </View>
      {children}
    </View>
  );
}

function FormField({
  label,
  containerStyle,
  ...props
}: TextInputProps & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={containerStyle}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        autoCorrect={false}
        placeholderTextColor={colors.disabled}
        style={styles.textInput}
        {...props}
      />
    </View>
  );
}

function QuantityUnitSelector({
  value,
  onChange
}: {
  value: QuantityUnit | null;
  onChange: (value: QuantityUnit | null) => void;
}) {
  const options: { value: QuantityUnit; label: string }[] = [
    { value: "logs", label: "Lóng" },
    { value: "packages", label: "Kiện" },
    { value: "boxes", label: "Hộp" }
  ];

  return (
    <View style={styles.unitSelector}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.unitOption, active && styles.unitOptionActive]}
          >
            <Text
              style={[styles.unitText, active && styles.unitTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      {value ? (
        <IconButton
          icon={X}
          label="Bỏ chọn đơn vị"
          onPress={() => onChange(null)}
        />
      ) : null}
    </View>
  );
}

function ImportSummary({ item }: { item: WoodImport }) {
  const progress =
    item.totalLogs === 0 ? 0 : item.receivedLogs / item.totalLogs;
  const displayName = importDisplayName(item);

  return (
    <View style={styles.importCard}>
      <View style={styles.importTop}>
        <View style={styles.importIdentity}>
          <Text style={styles.importCode} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.importFile} numberOfLines={1}>
            {displayName !== item.listCode ? item.listCode + " · " : ""}
            {item.originalFilename}
          </Text>
        </View>
        <View
          style={[
            styles.modeBadge,
            item.shipmentType === "container"
              ? styles.containerBadge
              : item.shipmentType === "loose"
                ? styles.looseBadge
                : styles.unspecifiedBadge
          ]}
        >
          <Text style={styles.modeBadgeText}>
            {shipmentTypeLabel(item.shipmentType)}
          </Text>
        </View>
      </View>
      <Text style={styles.shipmentMeta} numberOfLines={2}>
        {item.shipmentType === "container"
          ? (item.ownerName || "--") +
            " · " +
            (item.container20Count ?? "--") +
            " Cont 20' · " +
            (item.container40Count ?? "--") +
            " Cont 40'"
          : item.shipmentType === "loose"
            ? (item.ownerName || "--") +
              " · Tàu " +
              (item.vesselName || "--") +
              " · " +
              (item.woodSpecies || "--")
            : (item.ownerName || "Chưa có thông tin chủ hàng") +
              " · " +
              (item.woodSpecies || "Chưa có loại gỗ")}
      </Text>
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
        <Text style={styles.statText}>{formatVolume(item.totalVolumeCbm)}</Text>
      </View>
      {item.totalQuantity && item.quantityUnit ? (
        <Text style={styles.quantityText}>
          {"Tổng lô: " +
            item.totalQuantity +
            " " +
            quantityUnitLabel(item.quantityUnit)}
        </Text>
      ) : null}
      {item.declaredVolumeCbm !== null ? (
        <Text style={styles.quantityText}>
          {"Khối lượng lô: " + formatVolume(item.declaredVolumeCbm)}
        </Text>
      ) : null}
    </View>
  );
}

function validateDetails(details: ImportDetailsInput): string | null {
  if (details.shipmentType === "container") {
    if (
      (details.container20Count.trim() &&
        !/^\d+$/.test(details.container20Count)) ||
      (details.container40Count.trim() &&
        !/^\d+$/.test(details.container40Count))
    ) {
      return "Số container phải là số nguyên từ 0 trở lên.";
    }

  }

  if (
    details.totalQuantity.trim() &&
    (!/^\d+$/.test(details.totalQuantity) || Number(details.totalQuantity) <= 0)
  ) {
    return "Tổng số lượng phải là số nguyên lớn hơn 0.";
  }

  const normalizedVolume = details.declaredVolumeCbm.replace(",", ".");

  if (
    details.declaredVolumeCbm.trim() &&
    (!/^\d+(?:\.\d+)?$/.test(normalizedVolume) ||
      Number(normalizedVolume) <= 0)
  ) {
    return "Tổng khối lượng CBM phải là số lớn hơn 0.";
  }

  if (
    details.intakeStartDate.trim() &&
    !/^\d{4}-\d{2}-\d{2}$/.test(details.intakeStartDate)
  ) {
    return "Ngày bắt đầu nhập phải có dạng YYYY-MM-DD.";
  }

  return null;
}

function importDisplayName(item: WoodImport): string {
  if (item.shipmentType === "container") {
    return item.lotName || item.listCode;
  }

  return item.shipmentType === "loose"
    ? item.vesselName || item.listCode
    : item.listCode;
}

function shipmentTypeLabel(value: ShipmentType | null): string {
  return value === "container"
    ? "Container"
    : value === "loose"
      ? "Hàng rời"
      : "Chưa phân loại";
}

export function quantityUnitLabel(value: QuantityUnit): string {
  return { logs: "lóng", packages: "kiện", boxes: "hộp" }[value];
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
  typeSelector: {
    height: 58,
    flexDirection: "row",
    gap: 8
  },
  typeOption: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.surface
  },
  typeOptionActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft
  },
  typeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0
  },
  typeTextActive: {
    color: colors.primary
  },
  formSection: {
    gap: 9,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  formSectionTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  formSectionHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  optionalLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 5
  },
  textInput: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: 13,
    letterSpacing: 0
  },
  fieldRow: {
    flexDirection: "row",
    gap: 9
  },
  halfField: {
    flex: 1,
    minWidth: 0
  },
  unitSelector: {
    height: 44,
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 7,
    backgroundColor: colors.border
  },
  unitOption: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5
  },
  unitOptionActive: {
    backgroundColor: colors.surface
  },
  unitText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0
  },
  unitTextActive: {
    color: colors.primary,
    fontWeight: "900"
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
    gap: 9,
    ...shadows.card
  },
  importTop: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
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
  modeBadge: {
    minHeight: 25,
    borderRadius: 5,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  containerBadge: {
    backgroundColor: colors.blueSoft
  },
  looseBadge: {
    backgroundColor: colors.amberSoft
  },
  unspecifiedBadge: {
    backgroundColor: colors.background
  },
  modeBadgeText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  shipmentMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
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
  },
  quantityText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  }
});
