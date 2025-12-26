import type { Session } from "./sessions";

const DB_NAME = "agamotto_db";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const CONFIG_STORE = "config";

let dbInstance: IDBDatabase | null = null;

interface ConfigRecord {
  key: string;
  value: any;
}

/**
 * Initialize and open IndexedDB connection
 */
export async function initDatabase(): Promise<IDBDatabase> {
  // Return existing connection if available
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    // Check for migration before opening database
    const migrationCompleted = localStorage.getItem("agamotto_migration_completed");
    const needsMigration = !migrationCompleted && (
      localStorage.getItem("agamotto_sessions") ||
      localStorage.getItem("agamotto_stopgap") ||
      localStorage.getItem("agamotto_timer_state")
    );

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
        sessionsStore.createIndex("by_timestamp", "timestamp", { unique: false });
        sessionsStore.createIndex("by_state_and_timestamp", ["state", "timestamp"], {
          unique: false,
        });
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

/**
 * Save or update a session
 */
export async function saveSession(session: Session): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    // Validate single active session constraint
    if (session.state === "active" || session.state === "paused") {
      // Check if another session is already active/paused
      const transaction = db.transaction(SESSIONS_STORE, "readonly");
      const store = transaction.objectStore(SESSIONS_STORE);
      const index = store.index("by_state");

      const activeRequest = index.getAll(IDBKeyRange.only("active"));
      const pausedRequest = index.getAll(IDBKeyRange.only("paused"));

      Promise.all([
        new Promise<Session[]>((res, rej) => {
          activeRequest.onsuccess = () => res(activeRequest.result);
          activeRequest.onerror = () => rej(activeRequest.error);
        }),
        new Promise<Session[]>((res, rej) => {
          pausedRequest.onsuccess = () => res(pausedRequest.result);
          pausedRequest.onerror = () => rej(pausedRequest.error);
        }),
      ]).then(([activeSessions, pausedSessions]) => {
        const existingSessions = [...activeSessions, ...pausedSessions].filter(
          (s) => s.id !== session.id
        );

        if (existingSessions.length > 0) {
          reject(
            new Error(
              "Another session is already active or paused. Only one active session allowed."
            )
          );
          return;
        }

        // Proceed with save
        const writeTransaction = db.transaction(SESSIONS_STORE, "readwrite");
        const writeStore = writeTransaction.objectStore(SESSIONS_STORE);
        const request = writeStore.put(session);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }).catch(reject);
    } else {
      // No validation needed for other states
      const transaction = db.transaction(SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(SESSIONS_STORE);
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<Session | null> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get the currently active or paused session
 */
export async function getActiveSession(): Promise<Session | null> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index("by_state");

    const activeRequest = index.getAll(IDBKeyRange.only("active"));
    const pausedRequest = index.getAll(IDBKeyRange.only("paused"));

    Promise.all([
      new Promise<Session[]>((res, rej) => {
        activeRequest.onsuccess = () => res(activeRequest.result);
        activeRequest.onerror = () => rej(activeRequest.error);
      }),
      new Promise<Session[]>((res, rej) => {
        pausedRequest.onsuccess = () => res(pausedRequest.result);
        pausedRequest.onerror = () => rej(pausedRequest.error);
      }),
    ]).then(([activeSessions, pausedSessions]) => {
      const allActive = [...activeSessions, ...pausedSessions];

      if (allActive.length > 0) {
        resolve(allActive[0]);
      } else {
        resolve(null);
      }
    }).catch(reject);
  });
}

/**
 * Get all sessions with a specific state
 */
export async function getSessionsByState(state: string): Promise<Session[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const index = store.index("by_state");
    const request = index.getAll(IDBKeyRange.only(state));

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<Session[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSIONS_STORE, "readonly");
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a config value
 */
export async function saveConfig(key: string, value: any): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIG_STORE, "readwrite");
    const store = transaction.objectStore(CONFIG_STORE);
    const record: ConfigRecord = { key, value };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a config value
 */
export async function getConfig(key: string): Promise<any> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIG_STORE, "readonly");
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as ConfigRecord | undefined;
      resolve(result ? result.value : undefined);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get all config values as an object
 */
export async function getAllConfig(): Promise<Record<string, any>> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIG_STORE, "readonly");
    const store = transaction.objectStore(CONFIG_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as ConfigRecord[];
      const config: Record<string, any> = {};

      records.forEach((record) => {
        config[record.key] = record.value;
      });

      resolve(config);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<void> {
  console.log("Starting localStorage → IndexedDB migration");

  try {
    const db = await initDatabase();

    // Check if migration already completed
    const migrationFlag = localStorage.getItem("agamotto_migration_completed");
    if (migrationFlag) {
      console.log("Migration already completed, skipping");
      return;
    }

    // 1. Migrate sessions
    const oldSessions = localStorage.getItem("agamotto_sessions");
    if (oldSessions) {
      try {
        const sessions: Session[] = JSON.parse(oldSessions);

        for (const session of sessions) {
          // All old sessions are treated as "completed"
          const migratedSession: Session = {
            ...session,
            state: session.state || "completed",
          };

          // Save directly without validation for migration
          const transaction = db.transaction(SESSIONS_STORE, "readwrite");
          const store = transaction.objectStore(SESSIONS_STORE);
          await new Promise<void>((resolve, reject) => {
            const request = store.put(migratedSession);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }

        console.log(`Migrated ${sessions.length} sessions`);
      } catch (error) {
        console.error("Failed to migrate sessions:", error);
      }
    }

    // 2. Migrate stopgap config
    const oldStopgap = localStorage.getItem("agamotto_stopgap");
    if (oldStopgap) {
      try {
        await saveConfig("defaultStopgap", parseInt(oldStopgap, 10));
      } catch (error) {
        console.error("Failed to migrate stopgap:", error);
      }
    }

    // 3. Migrate timer state (if exists)
    const oldTimerState = localStorage.getItem("agamotto_timer_state");
    if (oldTimerState) {
      try {
        const state = JSON.parse(oldTimerState);

        // Create an active session from timer state
        const activeSession: Session = {
          id: crypto.randomUUID(),
          title: "",
          duration: 0,
          rating: 0,
          comment: "",
          timestamp: state.initialTimestamp || Date.now(),
          state: state.isRunning ? "active" : state.isPaused ? "paused" : "not_started",
        };

        // Save directly without validation for migration
        const transaction = db.transaction(SESSIONS_STORE, "readwrite");
        const store = transaction.objectStore(SESSIONS_STORE);
        await new Promise<void>((resolve, reject) => {
          const request = store.put(activeSession);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        await saveConfig("pauseTime", state.pauseTime || 0);
        await saveConfig("lastPausedTimestamp", state.lastPausedTimestamp || null);
        await saveConfig("activeSessionId", activeSession.id);

        console.log("Migrated timer state to active session");
      } catch (error) {
        console.error("Failed to migrate timer state:", error);
      }
    }

    // 4. Store backup before clearing
    const backup = {
      sessions: localStorage.getItem("agamotto_sessions"),
      stopgap: localStorage.getItem("agamotto_stopgap"),
      timerState: localStorage.getItem("agamotto_timer_state"),
      migrationDate: new Date().toISOString(),
    };

    await saveConfig("localStorage_backup", backup);

    // 5. Clear localStorage
    localStorage.removeItem("agamotto_sessions");
    localStorage.removeItem("agamotto_stopgap");
    localStorage.removeItem("agamotto_timer_state");

    // Mark migration as completed
    localStorage.setItem("agamotto_migration_completed", "true");

    console.log("Migration complete. localStorage cleared.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
