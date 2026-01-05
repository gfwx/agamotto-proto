import { initDatabase } from "./db";
import type { Session } from "./appSession";
import { SESSIONS_STORE } from "./constants";
import { saveConfig } from "./appConfig";

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<void> {
  console.log("Starting localStorage → IndexedDB migration");

  try {
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
          state: state.isRunning
            ? "active"
            : state.isPaused
              ? "paused"
              : "not_started",
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
        await saveConfig(
          "lastPausedTimestamp",
          state.lastPausedTimestamp || null,
        );
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
