import { MessageStatus as Status } from "../../../../../packages/shared-types/message";

interface MessageStatusProps {
  status: Status;
  isOwn: boolean;
}

export default function MessageStatus({
  status,
  isOwn,
}: MessageStatusProps) {
  // ❌ never show receipts for incoming messages
  if (!isOwn) return null;

  /**
   * RECEIPT POLICY
   * queued → ⏳
   * sent   → ✓
   * read   → ✓✓
   */

  // ⏳ QUEUED (offline / not sent yet)
  if (status === Status.QUEUED) {
    return (
      <span
        style={{
          marginLeft: 6,
          fontSize: 14,
          opacity: 0.7,
        }}
      >
        ⏳
      </span>
    );
  }

  // ✓ SENT
  if (status === Status.SENT) {
    return <span style={{ marginLeft: 6 }}>✓</span>;
  }

  // ✓✓ READ
  if (status === Status.READ) {
    return (
      <span
        style={{
          marginLeft: 6,
          color: "#34b7f1", // WhatsApp-like read color
        }}
      >
        ✓✓
      </span>
    );
  }

  return null;
}
