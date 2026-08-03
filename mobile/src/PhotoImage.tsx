import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import { ImageOff } from "lucide-react-native";
import { apiHeaders, photoUrl } from "./api";
import { colors } from "./theme";

const photoDirectory = new Directory(Paths.document, "wood-log-photos");
const downloads = new Map<string, Promise<string>>();

function ensurePhotoDirectory() {
  if (!photoDirectory.exists) {
    photoDirectory.create({ idempotent: true, intermediates: true });
  }
}

function localPhoto(photoId: string) {
  ensurePhotoDirectory();
  return new File(photoDirectory, photoId + ".jpg");
}

async function downloadPhoto(photoId: string): Promise<string> {
  const stored = localPhoto(photoId);

  if (stored.exists && stored.size > 0) {
    return stored.uri;
  }

  if (stored.exists) {
    stored.delete();
  }

  const response = await expoFetch(photoUrl(photoId), {
    headers: apiHeaders()
  });

  if (!response.ok) {
    throw new Error("Không tải được ảnh đã lưu.");
  }

  const bytes = await response.bytes();

  if (bytes.byteLength === 0) {
    throw new Error("Ảnh tải về không có dữ liệu.");
  }

  stored.write(bytes);
  return stored.uri;
}

function getStoredPhoto(photoId: string): Promise<string> {
  const current = downloads.get(photoId);

  if (current) {
    return current;
  }

  const task = downloadPhoto(photoId).finally(() => {
    downloads.delete(photoId);
  });
  downloads.set(photoId, task);
  return task;
}

export async function storeCapturedPhoto(photoId: string, uri: string) {
  const source = new File(uri);
  const destination = localPhoto(photoId);

  await source.copy(destination, { overwrite: true });
  return destination.uri;
}

export function removeStoredPhoto(photoId: string) {
  downloads.delete(photoId);
  const stored = localPhoto(photoId);

  if (stored.exists) {
    stored.delete();
  }
}

export function PhotoImage({
  accessibilityLabel,
  photoId,
  revision = 0,
  resizeMode = "cover",
  style
}: {
  accessibilityLabel?: string;
  photoId: string;
  revision?: number;
  resizeMode?: ImageProps["resizeMode"];
  style: StyleProp<ViewStyle>;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    setUri(null);
    setFailed(false);
    getStoredPhoto(photoId)
      .then((storedUri) => {
        if (active) {
          setUri(storedUri);
        }
      })
      .catch((caught) => {
        console.warn("Stored photo could not be loaded", caught);
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [photoId, revision]);

  return (
    <View style={[style, styles.frame]}>
      {uri && !failed ? (
        <Image
          accessibilityLabel={accessibilityLabel}
          key={photoId + ":" + revision}
          onError={() => setFailed(true)}
          resizeMode={resizeMode}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
        />
      ) : failed ? (
        <ImageOff color={colors.muted} size={24} />
      ) : (
        <ActivityIndicator color={colors.primary} size="small" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});
