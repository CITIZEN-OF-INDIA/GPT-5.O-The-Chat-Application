export interface SendMessagePayload {
  chatId: string;
  text: string;
  clientId: string;
  replyTo?: string;
}
