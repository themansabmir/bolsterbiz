export interface Chunk {
  text: string;
  articleId: string;
  articleTitle: string;
  chunkIndex: number;
}

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  type: 'answer' | 'escalation';
  message: string;
  confidence: number;
  reasoning: string;
  retrievedArticles: string[];
}

export interface LLMDecision {
  can_answer: boolean;
  confidence: number;
  answer: string;
  escalation_reason: string;
}
