import type { MouseEvent } from "react";

interface Props {
  username: string;
  onClick: () => void;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
  active?: boolean;
}

export default function ChatItem({
  username,
  onClick,
  onContextMenu,
  active = false,
}: Props) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        width: "60%",
        padding: "12px 16px",
        marginBottom: 8,
        cursor: "pointer",
        backgroundColor: active ? "#00ff6e" : "#e7f2fc",
        borderBottom: "1px solid #202c33",
        borderTop: "1px solid #202c33",
        borderRadius: 40,
        fontSize: 18,
        fontWeight: 500,
      }}
    >
      {username}
    </div>
  );
}
