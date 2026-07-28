// Generic AI provider interface
// This abstraction allows switching between AI providers without changing application logic

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  text: string
  timestamp: string
}

export interface AIProvider {
  generateResponse(messages: AIMessage[], timeoutMs?: number): Promise<AIResponse>
}
