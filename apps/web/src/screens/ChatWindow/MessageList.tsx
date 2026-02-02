import { useMessageStore } from "../../store/message.store";
import MessageBubble from "../../components/Message/MessageBubble";
import type { Message } from "../../../../../packages/shared-types/message";

interface MessageListProps {
  myUserId: string;
  chatId: string;
}

export default function MessageList({ myUserId, chatId }: MessageListProps) {
  // Filter messages for the active chat
  const messages = useMessageStore((s) =>
    s.messages.filter((m: Message) => m.chatId === chatId)
  );

  return (
    <>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} myUserId={myUserId} />
      ))}
    </>
  );
}
