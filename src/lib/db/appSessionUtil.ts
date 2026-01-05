import { initDatabase } from "./db";
import { SESSIONS_STORE } from "../constants";
import type { Tag } from "./appTagUtil";

export interface Session {
  id: string;
  title: string;
  duration: number;
  rating: number;
  comment: string;
  timestamp: number;
  state: "active" | "completed" | "aborted" | "paused" | "not_started";
  tag: Tag | null;
}

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
      ])
        .then(([activeSessions, pausedSessions]) => {
          const existingSessions = [
            ...activeSessions,
            ...pausedSessions,
          ].filter((s) => s.id !== session.id);

          if (existingSessions.length > 0) {
            reject(
              new Error(
                "Another session is already active or paused. Only one active session allowed.",
              ),
            );
            return;
          }

          // Proceed with save
          const writeTransaction = db.transaction(SESSIONS_STORE, "readwrite");
          const writeStore = writeTransaction.objectStore(SESSIONS_STORE);
          const request = writeStore.put(session);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
        .catch(reject);
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
    ])
      .then(([activeSessions, pausedSessions]) => {
        const allActive = [...activeSessions, ...pausedSessions];

        if (allActive.length > 0) {
          resolve(allActive[0]);
        } else {
          resolve(null);
        }
      })
      .catch(reject);
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
