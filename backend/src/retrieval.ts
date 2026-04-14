import { openai, EMBEDDING_MODEL } from './openai-client';
import { getIndexedChunks } from './embeddings';
import { RetrievalResult } from './types';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieve(query: string, topK = 3): Promise<RetrievalResult[]> {
  const chunks = getIndexedChunks();
  if (chunks.length === 0) {
    throw new Error('Index not built. Call buildIndex() before retrieving.');
  }

  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const scored: RetrievalResult[] = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
