export interface CreateSessionBody {
  model: string; // e.g. "anthropic/claude-opus-4-5" or just "claude-opus-4-5"
}

export interface SendMessageBody {
  text: string;
}

export interface SetApiKeyBody {
  apiKey: string;
}

export interface SessionSummary {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  firstMessage: string;
}
