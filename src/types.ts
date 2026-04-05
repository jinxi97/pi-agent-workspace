export interface CreateSessionBody {
  model: string; // Gemini model id, e.g. "gemini-2.5-pro"
}

export interface SendMessageBody {
  text: string;
}

export interface SessionSummary {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  firstMessage: string;
}
