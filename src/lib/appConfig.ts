// appConfig is a library that contains functions and interfaces that modify
// the current "state" of the app.
// Because it's hosted as a webapp, memory allocation is volatile and there is no
// application state. It's all dervied from global state, with the help of cached data ie. "config".

import { initDatabase } from "./db";
import { CONFIG_STORE } from "./constants";

export interface ConfigRecord {
  key: string;
  value: any;
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
