import { getAllSessions, getAllConfig, getActiveSession } from "./db";

/**
 * Setup debug API functions on window object
 */
export function setupDebugAPI(): void {
  if (typeof window !== "undefined") {
    // Add functions to window
    (window as any).viewAllSessions = async () => {
      try {
        const sessions = await getAllSessions();
        console.table(sessions);
        return sessions;
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        return null;
      }
    };

    (window as any).viewConfig = async () => {
      try {
        const config = await getAllConfig();
        console.table(config);
        return config;
      } catch (error) {
        console.error("Failed to fetch config:", error);
        return null;
      }
    };

    (window as any).viewActiveSession = async () => {
      try {
        const session = await getActiveSession();
        console.log("Active session:", session);
        return session;
      } catch (error) {
        console.error("Failed to fetch active session:", error);
        return null;
      }
    };

    console.log("🔍 Debug API loaded. Available commands:");
    console.log("  - window.viewAllSessions()");
    console.log("  - window.viewConfig()");
    console.log("  - window.viewActiveSession()");
  }
}
