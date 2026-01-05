import { DB_NAME, DB_VERSION, CONFIG_STORE, SESSIONS_STORE } from "./constants";
import { migrateFromLocalStorage } from "./appMigrationUtil";
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
          await migrateFromLocalStorage();
        } catch (error) {
          console.error("Migration failed:", error);
          // Continue anyway - migration can be retried
        }
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
    };
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
