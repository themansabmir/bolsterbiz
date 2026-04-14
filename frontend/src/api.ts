export interface ChatResponse {
  type: 'answer' | 'escalation';
  message: string;
  confidence: number;
  reasoning: string;
  retrievedArticles: string[];
}

export async function sendMessage(question: string): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
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
