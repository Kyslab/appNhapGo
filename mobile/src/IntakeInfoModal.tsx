import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Camera, CarFront, Clock3, X } from "lucide-react-native";
import { ActionButton, IconButton } from "./components";
import { formatIntakeTime, normalizeVehiclePlate } from "./intake";
import { colors } from "./theme";

export function IntakeInfoModal({
  visible,
  initialVehiclePlate,
  capturedAt,
  onClose,
  onConfirm
}: {
  visible: boolean;
  initialVehiclePlate: string;
  capturedAt: string;
  onClose: () => void;
  onConfirm: (vehiclePlate: string) => void;
}) {
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setVehiclePlate(initialVehiclePlate);
      setError(null);
    }
  }, [initialVehiclePlate, visible]);

  function confirm() {
    const normalized = normalizeVehiclePlate(vehiclePlate);

    if (!normalized) {
      setError("Vui lòng nhập biển số xe trước khi chụp ảnh.");
      return;
    }

    if (normalized.length > 30) {
      setError("Biển số xe không được dài quá 30 ký tự.");
      return;
    }

    onConfirm(normalized);
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityLabel="Đóng thông tin nhập hàng"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Thông tin nhập hàng</Text>
              <Text style={styles.subtitle}>Thông tin được lưu cùng cây gỗ</Text>
            </View>
            <IconButton icon={X} label="Đóng" onPress={onClose} />
          </View>

          <Text style={styles.label}>Biển số xe</Text>
          <View style={[styles.inputRow, error && styles.inputRowError]}>
            <CarFront color={colors.primary} size={20} />
            <TextInput
              accessibilityLabel="Biển số xe tài xế"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
              onChangeText={(value) => {
                setVehiclePlate(value);
                setError(null);
              }}
              onSubmitEditing={confirm}
              placeholder="Ví dụ: 51C-123.45"
              placeholderTextColor={colors.disabled}
              returnKeyType="done"
              style={styles.input}
              value={vehiclePlate}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.timeBand}>
            <Clock3 color={colors.blue} size={20} />
            <View style={styles.timeTextBlock}>
              <Text style={styles.timeLabel}>Thời gian nhập tự động</Text>
              <Text style={styles.timeValue}>{formatIntakeTime(capturedAt)}</Text>
            </View>
          </View>

          <ActionButton
            icon={Camera}
            label="Tiếp tục chụp ảnh"
            onPress={confirm}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 27, 21, 0.54)"
  },
  sheet: {
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.surface
  },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  titleBlock: {
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
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  label: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  inputRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.surface
  },
  inputRowError: {
    borderColor: colors.danger
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    letterSpacing: 0
  },
  timeBand: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blueSoft
  },
  timeTextBlock: {
    flex: 1,
    minWidth: 0
  },
  timeLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0
  },
  timeValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0
  }
});
