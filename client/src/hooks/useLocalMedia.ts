import { useEffect, useState } from "react";
import { describeMediaError } from "../lib/mediaErrors";

interface LocalMedia {
  stream: MediaStream | null;
  error: string | null;
}

/**
 * Camera and microphone, requested only while `enabled` is true.
 * Disabling it (or unmounting) stops the tracks, which turns the camera light off.
 */
export function useLocalMedia(enabled: boolean): LocalMedia {
  const [media, setMedia] = useState<LocalMedia>({ stream: null, error: null });

  useEffect(() => {
    if (!enabled) {
      setMedia({ stream: null, error: null });
      return;
    }

    let cancelled = false;
    let acquired: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        acquired = stream;
        setMedia({ stream, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setMedia({ stream: null, error: describeMediaError(err) });
      });

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);

  return media;
}
