
export type ConversationType = 'private' | 'group';

export interface IConversation {
  id: string;
  type: ConversationType;
  title: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationParticipant {
  conversationId: string;
  userId: string;
  joinedAt: Date;
}

export interface IConversationWithParticipants extends IConversation {
  participants: {
    id: string;
    name: string;
    email: string;
  }[];
}
