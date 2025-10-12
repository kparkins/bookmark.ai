// Storage utility functions for managing embeddings
// This can be imported and used by other scripts if needed

export class EmbeddingStorage {
  constructor() {
    this.STORAGE_KEY = 'embeddings';
  }

  // Get all embeddings
  async getAll() {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] || {};
  }

  // Get a specific embedding by ID
  async get(id) {
    const embeddings = await this.getAll();
    return embeddings[id] || null;
  }

  // Save a new embedding
  async save(embeddingData) {
    const id = `embedding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const embeddings = await this.getAll();

    embeddings[id] = {
      text: embeddingData.text,
      embedding: embeddingData.embedding,
      dimensions: embeddingData.dimensions,
      timestamp: embeddingData.timestamp || Date.now(),
      metadata: embeddingData.metadata || {}
    };

    await chrome.storage.local.set({ [this.STORAGE_KEY]: embeddings });
    return id;
  }

  // Update an existing embedding
  async update(id, updates) {
    const embeddings = await this.getAll();

    if (!embeddings[id]) {
      throw new Error(`Embedding with ID ${id} not found`);
    }

    embeddings[id] = {
      ...embeddings[id],
      ...updates,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ [this.STORAGE_KEY]: embeddings });
    return embeddings[id];
  }

  // Delete an embedding
  async delete(id) {
    const embeddings = await this.getAll();
    delete embeddings[id];
    await chrome.storage.local.set({ [this.STORAGE_KEY]: embeddings });
    return true;
  }

  // Delete all embeddings
  async clear() {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: {} });
    return true;
  }

  // Search embeddings by similarity (cosine similarity)
  async search(queryEmbedding, topK = 5) {
    const embeddings = await this.getAll();
    const results = [];

    for (const [id, data] of Object.entries(embeddings)) {
      const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);
      results.push({
        id,
        ...data,
        similarity
      });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Get storage usage statistics
  async getStats() {
    const embeddings = await this.getAll();
    const ids = Object.keys(embeddings);

    if (ids.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        averageSize: 0,
        oldestTimestamp: null,
        newestTimestamp: null
      };
    }

    const timestamps = ids.map(id => embeddings[id].timestamp);
    const bytesUsed = await chrome.storage.local.getBytesInUse([this.STORAGE_KEY]);

    return {
      count: ids.length,
      totalSize: bytesUsed,
      averageSize: Math.round(bytesUsed / ids.length),
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps)
    };
  }

  // Export embeddings as JSON
  async export() {
    const embeddings = await this.getAll();
    return JSON.stringify(embeddings, null, 2);
  }

  // Import embeddings from JSON
  async import(jsonString) {
    try {
      const embeddings = JSON.parse(jsonString);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: embeddings });
      return Object.keys(embeddings).length;
    } catch (error) {
      throw new Error(`Failed to import embeddings: ${error.message}`);
    }
  }
}

// Singleton instance
export const embeddingStorage = new EmbeddingStorage();
