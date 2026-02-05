import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker = ({ onSelect }: EmojiPickerProps) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "60px",
        left: "10px",
        zIndex: 1000,
      }}
    >
      <Picker
        data={data}
        onEmojiSelect={(e: any) => onSelect(e.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
};

export default EmojiPicker;
