import type { ReactNode } from "react";

/** Sticky bar of buttons along the bottom of the lobby and room screens. */
export default function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">{children}</div>
    </div>
  );
}
