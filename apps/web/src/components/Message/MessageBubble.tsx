import type { Message } from "../../../../../packages/shared-types/message";
import MessageStatus from "./MessageStatus";
import { useAuthStore } from "../../store/auth.store";

interface MessageBubbleProps {
  message: Message;
  myUserId?: string | null;
}

function formatIST(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function renderTextWithLinks(text: string) {
  const regex =
    /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s-]{7,}\d)/gi;

  return text.split(regex).map((part, index) => {
    if (!part) return null;

    // 🌐 URL
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "underline",
            color: "#0645AD",
            wordBreak: "break-word",
          }}
        >
          {part}
        </a>
      );
    }

    // 📧 Email
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
      return (
        <a
          key={index}
          href={`mailto:${part}`}
          style={{
            textDecoration: "underline",
            color: "#0645AD",
          }}
        >
          {part}
        </a>
      );
    }

    // 📞 Phone
    if (/^\+?\d[\d\s-]{7,}\d$/.test(part)) {
      const cleanNumber = part.replace(/[^\d+]/g, "");
      return (
        <a
          key={index}
          href={`tel:${cleanNumber}`}
          style={{
            textDecoration: "underline",
            color: "#0645AD",
          }}
        >
          {part}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}




export default function MessageBubble({
  message,
  myUserId,
}: MessageBubbleProps) {
  const token = useAuthStore((state) => state.token);
  const timeIST = message.createdAt
  ? formatIST(message.createdAt)
  : "";


  let currentUserId = myUserId ?? null;
  if (!currentUserId && token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.sub || null;
    } catch {
      currentUserId = null;
    }
  }

  const isOwn = message.senderId === currentUserId;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isOwn ? "flex-end" : "flex-start",
        padding: "4px 8px",
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          padding: "8px 12px",
          borderRadius: 12,
          background: isOwn ? "#efecec" : "#eddcd3",
          boxShadow: "1px 1px 7px rgb(0, 0, 0)",
          color: "#000000", // ✅ BLACK TEXT
          font: "18px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        {message.text && (
          <div
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              lineHeight: 1.4,
            }}
          >
              {renderTextWithLinks(message.text)}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 11,
            opacity: 0.7,
            marginTop: 4,
          }}
        >
            <span style={{color: "#000000", fontSize: "15px"}}>{timeIST}</span>
          <MessageStatus status={message.status} isOwn={isOwn} />
        </div>
      </div>
    </div>
  );
}
