import type { ReactNode } from "react";

/** The 16:9 box that holds a video, a placeholder, and any overlays. */
export default function VideoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
      {children}
    </div>
  );
}
