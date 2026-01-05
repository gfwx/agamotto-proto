import { initDatabase } from "./db";
import { TAGS_STORE } from "../constants";

export interface Tag {
  name: string; // Unique tag name
  color: string; // Hex color (unique constraint enforced)
  dateCreated: number; // Unix timestamp
  dateLastUsed: number; // Unix timestamp
  totalInstances: number; // Count of completed sessions
}

// Curated palette of 24 visually distinct colors with good contrast
export const COLOR_PALETTE = [
  "#767676",
  "#023E8A",
  "#276221", // defaults
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#CA8A04",
  "#65A30D",
  "#16A34A",
  "#059669",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#9333EA",
  "#C026D3",
  "#DB2777",
  "#E11D48",
  "#475569",
  "#64748B",
  "#78716C",
  "#A8A29E",
  "#EF4444",
  "#F97316",
];

/**
 * Save a tag (create or update)
 */
export async function saveTag(tag: Tag): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TAGS_STORE, "readwrite");
    const store = transaction.objectStore(TAGS_STORE);
    const request = store.put(tag);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a tag by name
 */
export async function getTag(name: string): Promise<Tag | null> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TAGS_STORE, "readonly");
    const store = transaction.objectStore(TAGS_STORE);
    const request = store.get(name);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get all tags sorted by dateLastUsed descending
 */
export async function getAllTags(): Promise<Tag[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TAGS_STORE, "readonly");
    const store = transaction.objectStore(TAGS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const tags = request.result as Tag[];
      // Sort by dateLastUsed descending (most recent first)
      tags.sort((a, b) => b.dateLastUsed - a.dateLastUsed);
      resolve(tags);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get colors that are not yet used by any tag
 */
export async function getAvailableColors(): Promise<string[]> {
  const tags = await getAllTags();
  const usedColors = new Set(tags.map((tag) => tag.color));
  return COLOR_PALETTE.filter((color) => !usedColors.has(color));
}

/**
 * Get the next available color from the palette
 * Returns null if all colors are used
 */
export async function getNextAvailableColor(): Promise<string | null> {
  const availableColors = await getAvailableColors();
  return availableColors.length > 0 ? availableColors[0] : null;
}

/**
 * Delete a tag by name
 */
export async function deleteTag(name: string): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TAGS_STORE, "readwrite");
    const store = transaction.objectStore(TAGS_STORE);
    const request = store.delete(name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the dateLastUsed timestamp for a tag
 */
export async function updateTagLastUsed(name: string): Promise<void> {
  const tag = await getTag(name);
  if (!tag) {
    throw new Error(`Tag "${name}" not found`);
  }

  tag.dateLastUsed = Date.now();
  await saveTag(tag);
}

/**
 * Increment the totalInstances count for a tag
 */
export async function incrementTagInstances(name: string): Promise<void> {
  const tag = await getTag(name);
  if (!tag) {
    throw new Error(`Tag "${name}" not found`);
  }

  tag.totalInstances += 1;
  await saveTag(tag);
}
