import { openai, EMBEDDING_MODEL } from './openai-client';
import { articles } from './articles';
import { Chunk, ChunkWithEmbedding } from './types';

const CHUNK_SIZE = 150; // words per chunk
const CHUNK_OVERLAP = 30; // word overlap between chunks

function chunkArticle(articleId: string, articleTitle: string, body: string): Chunk[] {
  const words = body.split(/\s+/);
  const chunks: Chunk[] = [];
  let i = 0;
  let chunkIndex = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    chunks.push({
      text: chunkWords.join(' '),
      articleId,
      articleTitle,
      chunkIndex: chunkIndex++,
    });
    if (i + CHUNK_SIZE >= words.length) break;
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

let indexedChunks: ChunkWithEmbedding[] = [];

export async function buildIndex(): Promise<void> {
  const allChunks: Chunk[] = articles.flatMap(article =>
    chunkArticle(article.id, article.title, article.body)
  );

  console.log(`Embedding ${allChunks.length} chunks across ${articles.length} articles...`);

  // Batch all chunks in a single API call for efficiency
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: allChunks.map(c => c.text),
  });

  indexedChunks = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: response.data[i].embedding,
  }));

  console.log(`Index ready: ${indexedChunks.length} chunks indexed.`);
}

export function getIndexedChunks(): ChunkWithEmbedding[] {
  return indexedChunks;
}
