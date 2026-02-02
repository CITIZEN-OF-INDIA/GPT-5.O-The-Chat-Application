import { saveMessageToDB } from '../db/models/Message.model';

/**
 * Queue handler for TEXT messages only (Phase 5)
 * This function:
 * 1. Receives message data
 * 2. Saves it to DB
 * 3. Returns saved message
 */
export const queueTextMessage = async (params: {
  chatId: string;
  senderId: string;
  text: string;
}) => {
  const { chatId, senderId, text } = params;

  // Save message to database
  const message = await saveMessageToDB({
    chatId,
    senderId,
    text,
    clientId: '', // No clientId in queue processing
  });

  return message;
};
