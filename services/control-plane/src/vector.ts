import { config } from "./config.js";

export interface VectorStore {
  upsert(sessionId: string, id: string, text: string, metadata?: Record<string, unknown>): Promise<void>;
  query(sessionId: string, text: string, topK: number): Promise<Array<Record<string, unknown>>>;
}

class InMemoryVectorStore implements VectorStore {
  private readonly rows: Array<{ sessionId: string; id: string; text: string; metadata?: Record<string, unknown> }> = [];

  async upsert(sessionId: string, id: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    this.rows.push({ sessionId, id, text, metadata });
  }

  async query(sessionId: string, text: string, topK: number): Promise<Array<Record<string, unknown>>> {
    return this.rows
      .filter((row) => row.sessionId === sessionId && row.text.toLowerCase().includes(text.toLowerCase()))
      .slice(0, topK)
      .map((row) => ({ id: row.id, text: row.text, metadata: row.metadata ?? {} }));
  }
}

class ChromaVectorStore implements VectorStore {
  async upsert(sessionId: string, id: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    await fetch(`${config.vector.chromaUrl}/api/v2/collections/${sessionId}/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id], documents: [text], metadatas: [metadata ?? {}] }),
    }).catch(() => undefined);
  }

  async query(sessionId: string, text: string, topK: number): Promise<Array<Record<string, unknown>>> {
    const response = await fetch(`${config.vector.chromaUrl}/api/v2/collections/${sessionId}/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query_texts: [text], n_results: topK }),
    }).catch(() => null);

    if (!response?.ok) {
      return [];
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return [payload];
  }
}

export function createVectorStore(): VectorStore {
  if (config.vector.provider === "chroma") {
    return new ChromaVectorStore();
  }

  return new InMemoryVectorStore();
}

export const vectorStore = createVectorStore();
