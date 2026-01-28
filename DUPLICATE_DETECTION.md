# Duplicate Detection in CSV Import

## Overview

The CSV import system now includes **automatic duplicate detection and removal** to ensure that duplicate sessions can **NEVER** exist in the database.

## How It Works

### Duplicate Identification

**Unique Identifier**: Timestamp (date + time combined)

A session is considered a duplicate if:
- A session already exists in the database with the **exact same timestamp**
- Example: Two sessions both starting at `27/01/2026 14:30:00` are duplicates

### Duplicate Resolution Strategy

When a duplicate is detected during import:

1. ✅ **EXISTING session is KEPT** (prioritized)
2. ❌ **IMPORT row is SKIPPED** (not imported)
3. 📊 **Duplicate is TRACKED** for reporting
4. ⚠️ **User is NOTIFIED** via toast notification

> **CRITICAL**: Existing data is ALWAYS prioritized over imported data. There is NO scenario where an import can overwrite existing data.

## Implementation Details

### Database Query
```typescript
// Load all existing sessions before import
const existingSessions = await getAllSessions();
const existingTimestamps = new Set(
  existingSessions.map((session) => session.timestamp),
);
```

### Duplicate Check
```typescript
// For each import row, check timestamp
if (existingTimestamps.has(timestamp)) {
  duplicateRows.push({
    rowNumber,
    timestamp,
    title: title.trim(),
  });
  continue; // Skip this row
}
```

### Result Tracking
```typescript
interface ImportResult {
  successCount: number;        // Successfully imported
  failedCount: number;          // Failed validation/errors
  duplicatesSkipped: number;    // Skipped duplicates
  duplicateRows: Array<{
    rowNumber: number;
    timestamp: number;
    title: string;
  }>;
}
```

## User Experience

### Toast Notifications

**When duplicates are found:**
```
⚠️ Import completed with issues

3 sessions imported successfully
2 duplicates skipped

Row 2: Duplicate timestamp - "Morning workout"
Row 5: Duplicate timestamp - "Afternoon session"
```

**When both failures and duplicates exist:**
```
⚠️ Import completed with issues

2 sessions imported successfully
1 session failed to import
2 duplicates skipped

Row 3: Invalid rating value
Row 4: Duplicate timestamp - "Evening run"
Row 6: Duplicate timestamp - "Night session"
```

**Complete success (no duplicates):**
```
✅ Import successful

5 sessions imported successfully
```

## Example Scenarios

### Scenario 1: Re-importing Backup

**Database state:**
```
27/01/2026,09:00:00,Morning workout,3600,4
27/01/2026,14:30:00,Afternoon work,5400,3
```

**Import CSV (backup from same day):**
```csv
27/01/2026,09:00:00,Morning workout,3600,4
27/01/2026,14:30:00,Afternoon work,5400,3
```

**Result:**
- 0 sessions imported
- 2 duplicates skipped
- Database unchanged (existing data protected)

### Scenario 2: Partial Duplicate Import

**Database state:**
```
27/01/2026,09:00:00,Morning workout,3600,4
```

**Import CSV:**
```csv
27/01/2026,09:00:00,Morning workout UPDATED,7200,5  ← DUPLICATE
27/01/2026,14:30:00,New afternoon session,5400,3    ← UNIQUE
27/01/2026,18:00:00,Evening session,2400,4          ← UNIQUE
```

**Result:**
- 2 sessions imported (14:30 and 18:00)
- 1 duplicate skipped (09:00)
- Original 09:00 session remains unchanged

### Scenario 3: Same CSV Imported Twice

**First import:**
```csv
27/01/2026,09:00:00,Morning workout,3600,4
27/01/2026,14:30:00,Afternoon work,5400,3
```

**Result:** 2 sessions imported

**Second import (same CSV):**

**Result:**
- 0 sessions imported
- 2 duplicates skipped
- Safe to re-import without creating duplicates

## Edge Cases Handled

### 1. Identical Timestamps (Impossible but Handled)

**Scenario:** Two different sessions with exact same timestamp

**Resolution:**
- Existing session is kept
- Import row is skipped
- User notified of duplicate

**Example:**
```
Database: 27/01/2026,09:00:00,Workout A
Import:   27/01/2026,09:00:00,Workout B
Result:   "Workout A" kept, "Workout B" skipped
```

### 2. Multiple Duplicates in Import File

**Scenario:** CSV contains internal duplicates + database duplicates

**Resolution:**
- First occurrence: Checked against database
  - If duplicate → skipped
  - If unique → imported
- Subsequent occurrences with same timestamp: Also skipped
- All duplicates tracked and reported

### 3. Empty Database

**Scenario:** Importing into fresh/empty database

**Resolution:**
- No duplicates possible (database is empty)
- All valid sessions import successfully
- Duplicate tracking returns 0

## Benefits

### Data Integrity
- ✅ No duplicate sessions can ever exist
- ✅ Database remains clean and consistent
- ✅ No manual deduplication needed

### Safe Operations
- ✅ Can re-import backups without worry
- ✅ Can import multiple exports safely
- ✅ Existing data never overwritten

### Clear Feedback
- ✅ User knows exactly what was skipped
- ✅ Duplicate rows clearly identified
- ✅ No silent failures

### Idempotent Imports
- ✅ Same import can run multiple times
- ✅ Result is always the same
- ✅ No side effects from re-imports

## Testing

### Test File: `test-import-duplicates.csv`

Contains intentional duplicates to test the system:

```csv
Date,Time,Title,Duration (seconds),Rating,Comment,Tag,State
27/01/2026,09:00:00,Morning workout,3600,4,First occurrence,routine,completed
27/01/2026,09:00:00,Morning workout DUPLICATE,3600,5,Should be skipped,routine,completed
27/01/2026,14:30:00,Afternoon session,5400,4,Unique session,work,completed
27/01/2026,14:30:00,Afternoon DUPLICATE,5400,3,Should be skipped,work,completed
27/01/2026,18:00:00,Evening session,7200,5,Unique session,sleep,completed
```

**Expected result when importing into empty database:**
- 3 sessions imported (09:00 first occurrence, 14:30 first occurrence, 18:00)
- 2 duplicates skipped (09:00 second occurrence, 14:30 second occurrence)

**Expected result when importing into database already containing these sessions:**
- 0 sessions imported
- 5 duplicates skipped (all rows match existing data)

## Technical Notes

### Performance
- Duplicate check uses `Set` for O(1) lookup performance
- All existing sessions loaded once at start of import
- Efficient even with thousands of sessions

### Memory
- Timestamps stored as numbers (8 bytes each)
- Set of 10,000 timestamps ≈ 80KB memory
- Negligible impact on performance

### Concurrency
- Import is asynchronous but sequential
- Each session checked and imported one at a time
- No race conditions possible

## Future Considerations

### Alternative Duplicate Strategies (NOT IMPLEMENTED)

These strategies were considered but rejected:

1. **Update instead of skip** ❌
   - Would overwrite existing data
   - Violates "existing data prioritized" constraint

2. **Ask user for each duplicate** ❌
   - Poor UX for bulk imports
   - Makes automated imports impossible

3. **Composite key (timestamp + title)** ❌
   - Timestamp alone is sufficient unique identifier
   - Adding title complicates matching logic

4. **Database-level unique constraint** ❌
   - Would cause hard errors instead of graceful skipping
   - Less user-friendly error messages

The current implementation (skip + notify) was chosen as the most user-friendly and safest approach.
