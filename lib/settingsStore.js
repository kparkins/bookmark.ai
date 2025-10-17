// IndexedDB wrapper for storing application settings
// Separate from embeddings database for cleaner separation of concerns

const SETTINGS_DB_NAME = "SettingsDB";
const SETTINGS_DB_VERSION = 1;
const SETTINGS_STORE_NAME = "settings";

class SettingsStore {
  constructor() {
    this.db = null;
  }

  // Initialize the database
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SETTINGS_DB_NAME, SETTINGS_DB_VERSION);

      request.onerror = () => {
        console.error("Settings database failed to open:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("Settings database opened successfully");
        resolve(this.db);
      };

      // Setup database schema
      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Delete old object store if it exists
        if (db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          db.deleteObjectStore(SETTINGS_STORE_NAME);
        }

        // Create object store with key path
        const objectStore = db.createObjectStore(SETTINGS_STORE_NAME, {
          keyPath: "key",
        });

        // Create indexes for efficient querying
        objectStore.createIndex("updatedAt", "updatedAt", { unique: false });

        console.log("Settings database setup complete");
      };
    });
  }

  // Get a setting by key
  async get(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [SETTINGS_STORE_NAME],
        "readonly",
      );
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all settings
  async getAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [SETTINGS_STORE_NAME],
        "readonly",
      );
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        // Convert array of {key, value} to object
        const settings = {};
        request.result.forEach((item) => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Set a setting
  async set(key, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [SETTINGS_STORE_NAME],
        "readwrite",
      );
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);

      const data = {
        key: key,
        value: value,
        updatedAt: Date.now(),
      };

      const request = objectStore.put(data);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error(`Error setting ${key}:`, request.error);
        reject(request.error);
      };
    });
  }

  // Delete a setting
  async delete(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [SETTINGS_STORE_NAME],
        "readwrite",
      );
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Clear all settings
  async clear() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [SETTINGS_STORE_NAME],
        "readwrite",
      );
      const objectStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Check if a setting exists
  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }
}

// Singleton instance
export const settingsStore = new SettingsStore();
