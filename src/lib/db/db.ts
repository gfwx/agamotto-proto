import {
  DB_NAME,
  DB_VERSION,
  CONFIG_STORE,
  SESSIONS_STORE,
  TAGS_STORE,
} from "../constants";
import { migrateFromLocalStorage } from "./appMigrationUtil";
import type { Tag } from "./appTagUtil";

let dbInstance: IDBDatabase | null = null;

export async function initDatabase(): Promise<IDBDatabase> {
  // Return existing connection if available
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    // Check for migration before opening database
    const migrationCompleted = localStorage.getItem(
      "agamotto_migration_completed",
    );
    const needsMigration =
      !migrationCompleted &&
      (localStorage.getItem("agamotto_sessions") ||
        localStorage.getItem("agamotto_stopgap") ||
        localStorage.getItem("agamotto_timer_state"));

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = async (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;

      // Run migration after database is opened
      if (needsMigration) {
        try {
          await migrateFromLocalStorage(dbInstance);
        } catch (error) {
          console.error("Migration failed:", error);
          // Continue anyway - migration can be retried
        }
      }

      // Initialize default tags if none exist
      try {
        await initializeDefaultTags(dbInstance);
      } catch (error) {
        console.error("Failed to initialize default tags:", error);
      }

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create sessions object store
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, {
          keyPath: "id",
        });

        // Create indexes
        sessionsStore.createIndex("by_state", "state", { unique: false });
        sessionsStore.createIndex("by_timestamp", "timestamp", {
          unique: false,
        });
        sessionsStore.createIndex(
          "by_state_and_timestamp",
          ["state", "timestamp"],
          {
            unique: false,
          },
        );
      }

      // Create config object store
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: "key" });
      }

      // Create tags object store
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        const tagsStore = db.createObjectStore(TAGS_STORE, {
          keyPath: "name",
        });

        // Create indexes
        tagsStore.createIndex("by_color", "color", { unique: true });
        tagsStore.createIndex("by_last_used", "dateLastUsed", {
          unique: false,
        });
        tagsStore.createIndex("by_instances", "totalInstances", {
          unique: false,
        });
      }
    };
  });
}

/**
 * Initialize default tags directly using the database instance
 */
async function initializeDefaultTags(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Check if tags store exists
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        console.warn("Tags store does not exist yet, skipping initialization");
        resolve();
        return;
      }

      // First check if tags already exist
      const checkTransaction = db.transaction(TAGS_STORE, "readonly");
      const checkStore = checkTransaction.objectStore(TAGS_STORE);
      const countRequest = checkStore.count();

      countRequest.onsuccess = () => {
        if (countRequest.result > 0) {
          // Tags already exist, no need to initialize
          resolve();
          return;
        }

        // No tags exist, create defaults
        const defaults = [
          { name: "routine", color: "#767676" },
          { name: "sleep", color: "#023E8A" },
          { name: "work", color: "#276221" },
        ];

        const timestamp = new Date("2026-01-01").getTime();

        const writeTransaction = db.transaction(TAGS_STORE, "readwrite");
        const writeStore = writeTransaction.objectStore(TAGS_STORE);

        // Add all default tags
        for (const def of defaults) {
          const tag: Tag = {
            name: def.name,
            color: def.color,
            dateCreated: timestamp,
            dateLastUsed: timestamp,
            totalInstances: 0,
          };
          writeStore.put(tag);
        }

        writeTransaction.oncomplete = () => resolve();
        writeTransaction.onerror = () => reject(writeTransaction.error);
      };

      countRequest.onerror = () => reject(countRequest.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
