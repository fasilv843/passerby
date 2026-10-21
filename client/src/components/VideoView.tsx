import { useEffect, useRef } from "react";

interface VideoViewProps {
  stream: MediaStream | null;
  /** Mute local previews so you don't hear yourself. */
  muted?: boolean;
  className?: string;
}

/** A <video> element showing a MediaStream. */
export default function VideoView({ stream, muted = false, className = "" }: VideoViewProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    // Autoplay can be refused until the user interacts with the page; the video starts on the next play().
    if (stream) video.play().catch(() => {});
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={`w-full h-full object-cover ${className}`} />;
}
