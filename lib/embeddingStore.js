import { HNSWIndex } from "./hnswIndex.js";

// IndexedDB wrapper for storing embeddings
// IndexedDB persists better than chrome.storage and survives most browsing data deletions

const DB_NAME = "EmbeddingsDB";
const DB_VERSION = 1;
const STORE_NAME = "embeddings";

class EmbeddingStore {
  constructor() {
    this.db = null;
    this.hnswIndex = null;
    this.indexDirty = true;
    this.indexPromise = null;
    this.cache = new Map();
  }

  // Initialize the database
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Database failed to open:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("Database opened successfully");
        resolve(this.db);
      };

      // Setup database schema
      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Delete old object store if it exists
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        // Create object store with auto-incrementing key
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: false,
        });

        // Create indexes for efficient querying
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
        objectStore.createIndex("text", "text", { unique: false });
        objectStore.createIndex("dimensions", "dimensions", { unique: false });

        console.log("Database setup complete");
      };
    });
  }

  // Generate unique ID
  generateId() {
    return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add a new embedding
  async add(embeddingData) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);

      const data = {
        id: this.generateId(),
        text: embeddingData.text,
        embedding: embeddingData.embedding,
        dimensions: embeddingData.dimensions,
        model: embeddingData.model,
        timestamp: embeddingData.timestamp || Date.now(),
        metadata: embeddingData.metadata || {},
      };

      const request = objectStore.add(data);

      request.onsuccess = () => {
        this.cache.set(data.id, data);

        if (this.hnswIndex && !this.indexDirty) {
          try {
            this.hnswIndex.addItem(data.id, data.embedding);
          } catch (error) {
            console.warn("Failed to add embedding to HNSW index:", error);
            this.indexDirty = true;
          }
        }

        resolve(data.id);
      };

      request.onerror = () => {
        console.error("Error adding embedding:", request.error);
        reject(request.error);
      };
    });
  }

  // Get a specific embedding by ID
  async get(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all embeddings
  async getAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get embeddings sorted by timestamp (newest first)
  async getAllSorted() {
    const all = await this.getAll();
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Update an embedding
  async update(id, updates) {
    await this.init();

    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Embedding with ID ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.put(updated);

      request.onsuccess = () => {
        this.cache.set(updated.id, updated);
        this.indexDirty = true;
        resolve(updated);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Delete an embedding
  async delete(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        this.cache.delete(id);
        this.indexDirty = true;
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Clear all embeddings
  async clear() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        this.cache.clear();
        this.hnswIndex = null;
        this.indexDirty = true;
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get count of embeddings
  async count() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Search embeddings using cosine similarity
  async search(queryEmbedding, topK = 5) {
    try {
      const index = await this.ensureIndex();
      const totalEmbeddings = this.cache.size;

      if (!index || !totalEmbeddings || topK >= totalEmbeddings) {
        return this.bruteForceSearch(queryEmbedding, topK);
      }

      const neighbors = index.search(queryEmbedding, topK);

      const results = neighbors
        .map((neighbor) => {
          const item = this.cache.get(neighbor.id);
          if (!item) {
            return null;
          }
          return {
            ...item,
            similarity: neighbor.similarity,
          };
        })
        .filter(Boolean);

      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, topK);
    } catch (error) {
      console.warn("HNSW search failed, falling back to brute force:", error);
      this.indexDirty = true;
      return this.bruteForceSearch(queryEmbedding, topK);
    }
  }

  async bruteForceSearch(queryEmbedding, topK = 5) {
    const all = await this.getAll();
    const results = [];

    for (const item of all) {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      results.push({
        ...item,
        similarity,
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async ensureIndex() {
    if (this.hnswIndex && !this.indexDirty) {
      return this.hnswIndex;
    }

    if (this.indexPromise) {
      return this.indexPromise;
    }

    this.indexPromise = (async () => {
      try {
        const embeddings = await this.getAll();
        this.cache = new Map();

        if (embeddings.length === 0) {
          this.hnswIndex = null;
          this.indexDirty = false;
          return null;
        }

        const firstWithEmbedding = embeddings.find(
          (item) => item?.embedding && item.embedding.length,
        );

        if (!firstWithEmbedding) {
          this.hnswIndex = null;
          this.indexDirty = false;
          return null;
        }

        const dimensions = firstWithEmbedding.embedding.length;
        const index = new HNSWIndex(dimensions, {
          M: 16,
          efSearch: 64,
          efConstruction: 200,
        });

        let added = 0;
        for (const embedding of embeddings) {
          this.cache.set(embedding.id, embedding);

          if (
            !embedding.embedding ||
            embedding.embedding.length !== dimensions
          ) {
            continue;
          }

          index.addItem(embedding.id, embedding.embedding);
          added++;
        }

        if (added === 0) {
          this.hnswIndex = null;
          this.indexDirty = false;
          return null;
        }

        this.hnswIndex = index;
        this.indexDirty = false;
        return this.hnswIndex;
      } catch (error) {
        this.indexDirty = true;
        throw error;
      } finally {
        this.indexPromise = null;
      }
    })();

    return this.indexPromise;
  }

  // Calculate cosine similarity
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same length");
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

  // Export all embeddings as JSON
  async exportJSON() {
    const all = await this.getAll();
    return JSON.stringify(all, null, 2);
  }

  // Export as downloadable file
  async exportToFile() {
    const json = await this.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `embeddings-backup-${timestamp}.json`;

    // For Chrome extension, we need to use downloads API
    if (chrome.downloads) {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true,
      });
    } else {
      // Fallback for popup context
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    return filename;
  }

  // Import embeddings from JSON
  async importJSON(jsonString) {
    const data = JSON.parse(jsonString);

    if (!Array.isArray(data)) {
      throw new Error("Invalid format: expected an array");
    }

    let imported = 0;
    for (const item of data) {
      if (item.embedding && item.text) {
        await this.add(item);
        imported++;
      }
    }

    return imported;
  }

  // Import from file
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const count = await this.importJSON(e.target.result);
          resolve(count);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsText(file);
    });
  }

  // Get storage statistics
  async getStats() {
    await this.init();

    const all = await this.getAll();

    if (all.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        averageSize: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const timestamps = all.map((item) => item.timestamp);
    const jsonSize = JSON.stringify(all).length;

    return {
      count: all.length,
      totalSize: jsonSize,
      averageDimensions: Math.round(
        all.reduce((sum, item) => sum + item.dimensions, 0) / all.length,
      ),
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
    };
  }
}

// Singleton instance
export const embeddingStore = new EmbeddingStore();
