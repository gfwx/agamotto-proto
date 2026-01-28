import type { Session } from "./db/appSessionUtil";
import { saveSession, getAllSessions } from "./db/appSessionUtil";
import { getTag } from "./db/appTagUtil";

/**
 * Result of CSV import validation
 */
export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sessionCount: number;
}

/**
 * Result of CSV import operation
 */
export interface ImportResult extends ImportValidationResult {
  successCount: number;
  failedCount: number;
  failedRows: Array<{ rowNumber: number; error: string }>;
  duplicatesSkipped: number;
  duplicateRows: Array<{ rowNumber: number; timestamp: number; title: string }>;
}

/**
 * Expected CSV headers
 *
 * CSV Format Requirements:
 * - Date: DD/MM/YYYY format (e.g., "27/01/2026" for January 27, 2026)
 * - Time: 24-hour format HH:MM:SS (e.g., "14:30:00" for 2:30 PM)
 * - Title: Session title (required, non-empty string)
 * - Duration (seconds): Number of seconds the session lasted
 * - Rating: Number between 0-5
 * - Comment: Any text (quotes will be escaped)
 * - Tag: Tag name (must exist in database, or empty)
 * - State: Must be "completed", "aborted", or "not_started"
 *          (active/paused sessions CANNOT be imported)
 */
const EXPECTED_HEADERS = [
  "Date",
  "Time",
  "Title",
  "Duration (seconds)",
  "Rating",
  "Comment",
  "Tag",
  "State",
];

/**
 * Valid session states
 */
const VALID_STATES = ["active", "completed", "aborted", "paused", "not_started"];

/**
 * States that are allowed to be imported
 * Note: "active" and "paused" are NOT allowed because only one active/paused session can exist at a time
 */
const IMPORTABLE_STATES = ["completed", "aborted", "not_started"];

/**
 * Parse date in DD/MM/YYYY format to timestamp
 */
function parseDateDDMMYYYY(dateStr: string, timeStr: string): number {
  // Expected format: DD/MM/YYYY and time in any standard format
  const dateParts = dateStr.trim().split("/");

  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format. Expected DD/MM/YYYY, got: ${dateStr}`);
  }

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(dateParts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date values in: ${dateStr}`);
  }

  // Parse time using a temporary date to extract hours, minutes, seconds
  const tempDate = new Date(`2000-01-01 ${timeStr}`);
  if (isNaN(tempDate.getTime())) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const hours = tempDate.getHours();
  const minutes = tempDate.getMinutes();
  const seconds = tempDate.getSeconds();

  // Create final date with DD/MM/YYYY and parsed time
  const finalDate = new Date(year, month, day, hours, minutes, seconds);

  if (isNaN(finalDate.getTime())) {
    throw new Error(`Cannot create valid date from: ${dateStr} ${timeStr}`);
  }

  return finalDate.getTime();
}

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): string[][] {
  const lines = content.split("\n").filter((line) => line.trim());
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle escaped quotes ("")
        if (insideQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        row.push(currentCell);
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell); // Add last cell
    rows.push(row);
  }

  return rows;
}

/**
 * Validate CSV schema and data
 */
export function validateCSV(content: string): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      errors: ["CSV file is empty"],
      warnings: [],
      sessionCount: 0,
    };
  }

  const rows = parseCSV(content);

  if (rows.length === 0) {
    return {
      isValid: false,
      errors: ["CSV file contains no data"],
      warnings: [],
      sessionCount: 0,
    };
  }

  // Validate headers
  const headers = rows[0];
  if (headers.length !== EXPECTED_HEADERS.length) {
    errors.push(
      `Invalid header count. Expected ${EXPECTED_HEADERS.length} columns, got ${headers.length}`,
    );
  }

  const missingHeaders = EXPECTED_HEADERS.filter(
    (expected, index) => headers[index] !== expected,
  );
  if (missingHeaders.length > 0) {
    errors.push(
      `Invalid or missing headers. Expected: ${EXPECTED_HEADERS.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      sessionCount: 0,
    };
  }

  // Validate data rows
  const dataRows = rows.slice(1);

  if (dataRows.length === 0) {
    return {
      isValid: false,
      errors: ["CSV file contains no data rows (only headers)"],
      warnings: [],
      sessionCount: 0,
    };
  }

  let validRowCount = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because: 1-indexed + 1 for header row

    if (row.length !== EXPECTED_HEADERS.length) {
      errors.push(
        `Row ${rowNumber}: Expected ${EXPECTED_HEADERS.length} columns, got ${row.length}`,
      );
      return;
    }

    const [date, time, title, duration, rating, comment, tag, state] = row;

    // Validate required fields
    if (!date || date.trim().length === 0) {
      errors.push(`Row ${rowNumber}: Date is required`);
    }

    if (!time || time.trim().length === 0) {
      errors.push(`Row ${rowNumber}: Time is required`);
    }

    if (!title || title.trim().length === 0) {
      errors.push(`Row ${rowNumber}: Title is required`);
    }

    // Validate duration
    const durationNum = parseFloat(duration);
    if (isNaN(durationNum) || durationNum < 0) {
      errors.push(`Row ${rowNumber}: Duration must be a non-negative number`);
    }

    // Validate rating
    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      errors.push(`Row ${rowNumber}: Rating must be a number between 0 and 5`);
    }

    // Validate state
    if (!VALID_STATES.includes(state)) {
      errors.push(
        `Row ${rowNumber}: Invalid state "${state}". Must be one of: ${VALID_STATES.join(", ")}`,
      );
    }

    // Validate date/time parsing (DD/MM/YYYY format)
    try {
      const timestamp = parseDateDDMMYYYY(date, time);
      if (isNaN(timestamp)) {
        errors.push(
          `Row ${rowNumber}: Invalid date/time format. Expected DD/MM/YYYY for date. Date: "${date}", Time: "${time}"`,
        );
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      errors.push(
        `Row ${rowNumber}: Cannot parse date/time. ${errorMsg}`,
      );
    }

    // CRITICAL: Reject active or paused sessions - only one allowed at a time
    if (state === "active" || state === "paused") {
      errors.push(
        `Row ${rowNumber}: Cannot import "${state}" sessions. The system only allows one active/paused session at a time. Change state to "completed" or "aborted" before importing.`,
      );
    }

    if (tag && tag.trim().length > 0) {
      // Tag will be validated during import when we check if it exists
      validRowCount++;
    } else {
      validRowCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sessionCount: dataRows.length,
  };
}

/**
 * Import sessions from CSV content
 *
 * CRITICAL CONSTRAINTS:
 * 1. Will REJECT any import containing sessions with state "active" or "paused".
 *    The system enforces that only ONE active or paused session can exist at any time.
 *    All imported sessions must have state "completed", "aborted", or "not_started".
 *
 * 2. Will REJECT duplicate sessions based on timestamp. If a session with the same
 *    timestamp already exists in the database, the import row is skipped.
 *    EXISTING DATA IS ALWAYS PRIORITIZED over imported data.
 */
export async function importSessionsFromCSV(
  content: string,
): Promise<ImportResult> {
  // First validate the CSV
  const validation = validateCSV(content);

  if (!validation.isValid) {
    return {
      ...validation,
      successCount: 0,
      failedCount: 0,
      failedRows: [],
      duplicatesSkipped: 0,
      duplicateRows: [],
    };
  }

  // Get all existing sessions to check for duplicates
  // Duplicates are determined by timestamp - if timestamp matches, it's a duplicate
  const existingSessions = await getAllSessions();
  const existingTimestamps = new Set(
    existingSessions.map((session) => session.timestamp),
  );

  const rows = parseCSV(content);
  const dataRows = rows.slice(1); // Skip header

  let successCount = 0;
  const failedRows: Array<{ rowNumber: number; error: string }> = [];
  const duplicateRows: Array<{ rowNumber: number; timestamp: number; title: string }> = [];
  const additionalWarnings: string[] = [...validation.warnings];

  // Import each session
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2; // +2 for 1-indexed + header row

    try {
      const [date, time, title, duration, rating, comment, tagName, state] =
        row;

      // CRITICAL SAFETY CHECK: Never import active or paused sessions
      if (state === "active" || state === "paused") {
        failedRows.push({
          rowNumber,
          error: `Cannot import "${state}" sessions. System constraint: only one active/paused session allowed at a time.`,
        });
        continue;
      }

      // Parse timestamp (DD/MM/YYYY format)
      const timestamp = parseDateDDMMYYYY(date, time);

      // CRITICAL: Check for duplicate timestamp - existing data is always prioritized
      if (existingTimestamps.has(timestamp)) {
        duplicateRows.push({
          rowNumber,
          timestamp,
          title: title.trim(),
        });
        continue; // Skip this row, don't import duplicate
      }

      // Get tag if specified
      let tag = null;
      if (tagName && tagName.trim().length > 0) {
        tag = await getTag(tagName.trim());
        if (!tag) {
          additionalWarnings.push(
            `Row ${rowNumber}: Tag "${tagName}" not found. Session will be imported without tag.`,
          );
        }
      }

      // Create session object
      const session: Session = {
        id: `imported_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        duration: parseFloat(duration) * 1000, // Convert seconds to milliseconds
        rating: parseFloat(rating),
        comment: comment.trim(),
        timestamp,
        state: state as Session["state"],
        tag,
      };

      // Save session
      await saveSession(session);
      successCount++;
    } catch (error) {
      failedRows.push({
        rowNumber,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: additionalWarnings,
    sessionCount: dataRows.length,
    successCount,
    failedCount: failedRows.length,
    failedRows,
    duplicatesSkipped: duplicateRows.length,
    duplicateRows,
  };
}

/**
 * Read file content from File object
 */
export function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };

    reader.readAsText(file);
  });
}
