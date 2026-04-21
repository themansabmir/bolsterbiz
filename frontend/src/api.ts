export interface ChatResponse {
  type: 'answer' | 'escalation';
  message: string;
  confidence: number;
  reasoning: string;
  retrievedArticles: string[];
}

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export async function sendMessage(question: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error?: string }).error ?? `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<ChatResponse>;
}
