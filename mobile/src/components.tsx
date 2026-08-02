import type { ComponentType, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextStyle,
  type ViewStyle
} from "react-native";
import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  type LucideProps
} from "lucide-react-native";
import { colors, shadows } from "./theme";
import type { LogStatus, WoodLog } from "./types";

type IconType = ComponentType<LucideProps>;

export function ActionButton({
  label,
  icon: Icon,
  busy,
  variant = "primary",
  disabled,
  style,
  ...props
}: PressableProps & {
  label: string;
  icon: IconType;
  busy?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
}) {
  const isDisabled = disabled || busy;
  const palette = {
    primary: {
      background: colors.primary,
      border: colors.primary,
      text: colors.surface
    },
    secondary: {
      background: colors.surface,
      border: colors.border,
      text: colors.ink
    },
    danger: {
      background: colors.danger,
      border: colors.danger,
      text: colors.surface
    }
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: isDisabled ? colors.disabled : palette.background,
          borderColor: isDisabled ? colors.disabled : palette.border,
          opacity: pressed ? 0.82 : 1
        },
        style
      ]}
      {...props}
    >
      {busy ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Icon color={palette.text} size={19} strokeWidth={2.2} />
      )}
      <Text style={[styles.actionLabel, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  ...props
}: PressableProps & { icon: IconType; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.6 : 1 }
      ]}
      {...props}
    >
      <Icon color={colors.ink} size={22} />
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: LogStatus }) {
  const received = status === "received";
  const Icon = received ? CheckCircle2 : Clock3;

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: received ? colors.primarySoft : colors.amberSoft }
      ]}
    >
      <Icon
        color={received ? colors.primary : colors.amber}
        size={15}
        strokeWidth={2.3}
      />
      <Text
        style={[
          styles.statusText,
          { color: received ? colors.primary : colors.amber }
        ]}
      >
        {received ? "Đã nhận" : "Chờ về kho"}
      </Text>
    </View>
  );
}

function formatMetric(value: number | null, suffix: string): string {
  if (value === null) {
    return "--";
  }

  return (
    new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: suffix === "CBM" ? 3 : 2
    }).format(value) +
    " " +
    suffix
  );
}

export function LogCard({
  log,
  onPress
}: {
  log: WoodLog;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.logTopRow}>
        <View style={styles.logIdentity}>
          <Text style={styles.logEyebrow}>{log.listCode}</Text>
          <Text style={styles.logNumber} numberOfLines={1} adjustsFontSizeToFit>
            {log.logNo}
          </Text>
        </View>
        <StatusBadge status={log.status} />
      </View>
      <Text style={styles.cargoText} numberOfLines={1}>
        {log.cargo || "Chưa có loại gỗ"}
      </Text>
      <View style={styles.metricsRow}>
        <Metric label="Dài" value={formatMetric(log.lengthM, "m")} />
        <Metric label="Đường kính" value={formatMetric(log.diameterCm, "cm")} />
        <Metric label="Thể tích" value={formatMetric(log.volumeCbm, "CBM")} />
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.logCard}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.logCard,
        { opacity: pressed ? 0.82 : 1 }
      ]}
    >
      {content}
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function Notice({
  title,
  children,
  tone = "neutral"
}: {
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "success" | "error";
}) {
  const palette = {
    neutral: {
      background: colors.blueSoft,
      border: colors.blue,
      title: colors.blue
    },
    success: {
      background: colors.primarySoft,
      border: colors.primary,
      title: colors.primary
    },
    error: {
      background: colors.dangerSoft,
      border: colors.danger,
      title: colors.danger
    }
  }[tone];

  return (
    <View
      style={[
        styles.notice,
        {
          backgroundColor: palette.background,
          borderLeftColor: palette.border
        }
      ]}
    >
      <Text style={[styles.noticeTitle, { color: palette.title }]}>{title}</Text>
      {children ? <Text style={styles.noticeBody}>{children}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message
}: {
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <FileQuestion color={colors.muted} size={34} strokeWidth={1.7} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

export const screenText = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0
  } as TextStyle,
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0
  } as TextStyle,
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  } as TextStyle
});

const styles = StyleSheet.create({
  actionButton: {
    minHeight: 48,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  statusBadge: {
    minHeight: 29,
    borderRadius: 6,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0
  },
  logCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    gap: 10,
    ...shadows.card
  },
  logTopRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  logIdentity: {
    flex: 1,
    minWidth: 0
  },
  logEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  logNumber: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0
  },
  cargoText: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0
  },
  metricsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 8
  },
  metric: {
    flex: 1,
    minWidth: 0
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0
  },
  metricValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0
  },
  notice: {
    borderLeftWidth: 4,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 4,
    gap: 3
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  noticeBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0
  },
  emptyState: {
    minHeight: 190,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    letterSpacing: 0
  }
});
