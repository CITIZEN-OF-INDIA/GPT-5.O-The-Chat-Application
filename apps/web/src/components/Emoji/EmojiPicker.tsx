import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  isMobile?: boolean;
  mobileHeight?: number;
  mobileWidth?: number;
}

const EmojiPicker = ({
  onSelect,
  isMobile = false,
  mobileHeight,
  mobileWidth,
}: EmojiPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;

    const applyHostWidth = () => {
      const host = containerRef.current?.querySelector("em-emoji-picker") as HTMLElement | null;
      if (!host) {
        rafId = window.requestAnimationFrame(applyHostWidth);
        return;
      }

      if (!isMobile) {
        host.style.removeProperty("width");
        host.style.removeProperty("min-width");
        host.style.removeProperty("max-width");
        host.style.removeProperty("border-radius");
        return;
      }

      const width = mobileWidth ? `${mobileWidth}px` : "100dvw";
      host.style.width = width;
      host.style.minWidth = width;
      host.style.maxWidth = width;
      host.style.borderRadius = "0";
    };

    applyHostWidth();

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isMobile, mobileWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        zIndex: 1000,
        width: isMobile ? "100%" : "auto",
        maxWidth: isMobile ? "100%" : "none",
      }}
    >
      <Picker
        data={data}
        onEmojiSelect={(e: any) => onSelect(e.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        searchPosition={isMobile ? "none" : "sticky"}
        dynamicWidth={isMobile}
        height={isMobile && mobileHeight ? mobileHeight : undefined}
      />
    </div>
  );
};

export default EmojiPicker;
