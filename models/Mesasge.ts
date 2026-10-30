
export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageWithSender extends IMessage {
  sender: {
    id: string;
    name: string;
    email: string;
  };
}

export const MESSAGE_VALIDATION = {
  maxLength: 5000,
  minLength: 1,
} as const;
