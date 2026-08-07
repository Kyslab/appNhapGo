import { useEffect, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps
} from "react-native";
import { Container, PackageOpen, Save, X } from "lucide-react-native";
import { ActionButton, IconButton, Notice } from "./components";
import { colors } from "./theme";
import type {
  ImportUpdateInput,
  QuantityUnit,
  ShipmentType,
  WoodImport
} from "./types";

export function ImportEditModal({
  item,
  busy,
  error,
  onClose,
  onSave
}: {
  item: WoodImport | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: ImportUpdateInput) => void;
}) {
  const [draft, setDraft] = useState<ImportUpdateInput | null>(null);

  useEffect(() => {
    setDraft(item ? importToDraft(item) : null);
  }, [item?.id]);

  function update<Key extends keyof ImportUpdateInput>(
    key: Key,
    value: ImportUpdateInput[Key]
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={busy ? undefined : onClose}
      transparent
      visible={item !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityLabel="Đóng màn hình sửa file"
          disabled={busy}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {item && draft ? (
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Chỉnh sửa file</Text>
                <Text numberOfLines={1} style={styles.subtitle}>
                  {item.listCode}
                </Text>
              </View>
              <IconButton
                disabled={busy}
                icon={X}
                label="Đóng"
                onPress={onClose}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormSection title="File Excel">
                <FormField
                  label="Tên file"
                  onChangeText={(value) => update("originalFilename", value)}
                  value={draft.originalFilename}
                />
              </FormSection>

              <FormSection title="Hình thức nhập hàng">
                <ShipmentSelector
                  onChange={(value) => update("shipmentType", value)}
                  value={draft.shipmentType}
                />
              </FormSection>

              <FormSection optional title="Chủ hàng">
                <FormField
                  label="Tên chủ hàng"
                  onChangeText={(value) => update("ownerName", value)}
                  value={draft.ownerName}
                />
                <FormField
                  keyboardType="phone-pad"
                  label="Điện thoại liên hệ"
                  onChangeText={(value) => update("contactPhone", value)}
                  value={draft.contactPhone}
                />
              </FormSection>

              <FormSection optional title="Thông tin lô hàng">
                {draft.shipmentType === "container" ? (
                  <>
                    <FormField
                      label="Tên lô hàng"
                      onChangeText={(value) => update("lotName", value)}
                      value={draft.lotName}
                    />
                    <FormField
                      label="Loại gỗ"
                      onChangeText={(value) => update("woodSpecies", value)}
                      value={draft.woodSpecies}
                    />
                    <View style={styles.fieldRow}>
                      <View style={styles.halfField}>
                        <FormField
                          keyboardType="number-pad"
                          label="Số Cont 20'"
                          onChangeText={(value) =>
                            update("container20Count", value)
                          }
                          value={draft.container20Count}
                        />
                      </View>
                      <View style={styles.halfField}>
                        <FormField
                          keyboardType="number-pad"
                          label="Số Cont 40'"
                          onChangeText={(value) =>
                            update("container40Count", value)
                          }
                          value={draft.container40Count}
                        />
                      </View>
                    </View>
                    <FormField
                      label="Nơi lấy container"
                      onChangeText={(value) =>
                        update("containerPickupLocation", value)
                      }
                      value={draft.containerPickupLocation}
                    />
                  </>
                ) : (
                  <>
                    <FormField
                      label="Tên tàu"
                      onChangeText={(value) => update("vesselName", value)}
                      value={draft.vesselName}
                    />
                    <FormField
                      label="Loại gỗ"
                      onChangeText={(value) => update("woodSpecies", value)}
                      value={draft.woodSpecies}
                    />
                    <FormField
                      label="Nơi lấy gỗ"
                      onChangeText={(value) =>
                        update("woodPickupLocation", value)
                      }
                      value={draft.woodPickupLocation}
                    />
                  </>
                )}
              </FormSection>

              <FormSection optional title="Tổng hợp lô hàng">
                <FormField
                  label="Ngày bắt đầu nhập"
                  maxLength={10}
                  onChangeText={(value) => update("intakeStartDate", value)}
                  placeholder="YYYY-MM-DD"
                  value={draft.intakeStartDate}
                />
                <FormField
                  keyboardType="number-pad"
                  label="Tổng số lượng"
                  onChangeText={(value) => update("totalQuantity", value)}
                  value={draft.totalQuantity}
                />
                <Text style={styles.fieldLabel}>Đơn vị</Text>
                <QuantitySelector
                  onChange={(value) => update("quantityUnit", value)}
                  value={draft.quantityUnit}
                />
                <FormField
                  keyboardType="decimal-pad"
                  label="Tổng khối lượng (CBM)"
                  onChangeText={(value) =>
                    update("declaredVolumeCbm", value)
                  }
                  value={draft.declaredVolumeCbm}
                />
              </FormSection>

              {error ? (
                <Notice title="Không thể lưu thay đổi" tone="error">
                  {error}
                </Notice>
              ) : null}

              <ActionButton
                busy={busy}
                icon={Save}
                label="Lưu thay đổi"
                onPress={() => onSave(draft)}
              />
            </ScrollView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function importToDraft(item: WoodImport): ImportUpdateInput {
  return {
    originalFilename: item.originalFilename,
    shipmentType: item.shipmentType,
    ownerName: item.ownerName ?? "",
    contactPhone: item.contactPhone ?? "",
    lotName: item.lotName ?? "",
    vesselName: item.vesselName ?? "",
    woodSpecies: item.woodSpecies ?? "",
    container20Count: String(item.container20Count),
    container40Count: String(item.container40Count),
    containerPickupLocation: item.containerPickupLocation ?? "",
    woodPickupLocation: item.woodPickupLocation ?? "",
    intakeStartDate: item.intakeStartDate?.slice(0, 10) ?? "",
    totalQuantity: item.totalQuantity === null ? "" : String(item.totalQuantity),
    quantityUnit: item.quantityUnit ?? "logs",
    declaredVolumeCbm:
      item.declaredVolumeCbm === null ? "" : String(item.declaredVolumeCbm)
  };
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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {optional ? <Text style={styles.optionalLabel}>Không bắt buộc</Text> : null}
      </View>
      {children}
    </View>
  );
}

function FormField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        placeholderTextColor={colors.disabled}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function ShipmentSelector({
  value,
  onChange
}: {
  value: ShipmentType;
  onChange: (value: ShipmentType) => void;
}) {
  const options = [
    { value: "container" as const, label: "Container", icon: Container },
    { value: "loose" as const, label: "Hàng rời", icon: PackageOpen }
  ];

  return (
    <View style={styles.selector}>
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.selectorOption, active && styles.selectorOptionActive]}
          >
            <Icon color={active ? colors.primary : colors.muted} size={18} />
            <Text
              style={[styles.selectorText, active && styles.selectorTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuantitySelector({
  value,
  onChange
}: {
  value: QuantityUnit;
  onChange: (value: QuantityUnit) => void;
}) {
  const options: { value: QuantityUnit; label: string }[] = [
    { value: "logs", label: "Lóng" },
    { value: "packages", label: "Kiện" },
    { value: "boxes", label: "Hộp" }
  ];

  return (
    <View style={styles.selector}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.selectorOption, active && styles.selectorOptionActive]}
          >
            <Text
              style={[styles.selectorText, active && styles.selectorTextActive]}
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
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 27, 21, 0.48)"
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingTop: 8
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.border
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 30
  },
  section: {
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0
  },
  sectionHeader: {
    minHeight: 22,
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
  field: {
    gap: 5
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontSize: 14,
    letterSpacing: 0
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10
  },
  halfField: {
    flex: 1,
    minWidth: 0
  },
  selector: {
    minHeight: 44,
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: 7,
    backgroundColor: colors.border
  },
  selectorOption: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 5,
    paddingHorizontal: 8
  },
  selectorOptionActive: {
    backgroundColor: colors.surface
  },
  selectorText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  selectorTextActive: {
    color: colors.primary,
    fontWeight: "900"
  }
});
