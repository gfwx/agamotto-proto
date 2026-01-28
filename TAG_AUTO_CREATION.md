# Automatic Tag Creation in CSV Import

## Overview

The CSV import system now **automatically creates missing tags** during import. This eliminates the need to manually create tags before importing sessions, making data migration and backup restoration seamless.

## How It Works

### 1. Tag Extraction

Before importing any sessions, the system:
- Scans all rows in the CSV
- Extracts unique tag names from the "Tag" column
- Creates a list of tags that need to be processed

### 2. Existence Check

For each unique tag found in the CSV:
- Query the database to check if the tag already exists
- If exists: Skip to next tag
- If doesn't exist: Mark for creation

### 3. Automatic Creation

For each missing tag:
- Get the next available color from the 24-color palette
- Create a new tag with:
  - **name**: From CSV
  - **color**: Next available from palette
  - **dateCreated**: Current timestamp
  - **dateLastUsed**: Current timestamp
  - **totalInstances**: 0 (will be incremented as sessions import)
- Save to database

### 4. Session Import

After all tags are created or verified to exist:
- Proceed with normal session import
- Each session can now reference its tag successfully
- No "tag not found" warnings

## Color Assignment Strategy

### Available Colors

The system uses a predefined palette of 24 distinct colors:
```typescript
[
  "#767676", "#023E8A", "#276221", // Default tags
  "#DC2626", "#EA580C", "#D97706", "#CA8A04",
  "#65A30D", "#16A34A", "#059669", "#0891B2",
  "#0284C7", "#2563EB", "#4F46E5", "#7C3AED",
  "#9333EA", "#C026D3", "#DB2777", "#E11D48",
  "#475569", "#64748B", "#78716C", "#A8A29E",
  "#EF4444", "#F97316"
]
```

### Color Selection

- **Sequential**: Colors are assigned in order from the available list
- **No Duplicates**: `getAvailableColors()` filters out already-used colors
- **First Available**: The first color in the available list is used for each new tag
- **Dynamic Update**: After each tag creation, the available colors list is updated

### Example

**Initial state:**
- Existing tags: 3 (routine, sleep, work)
- Available colors: 21

**CSV contains new tags:**
- "fitness" → Gets color #4 (DC2626)
- "education" → Gets color #5 (EA580C)
- "cooking" → Gets color #6 (D97706)

**Result:**
- Available colors: 18 (21 - 3 = 18)

## Maximum Tags Limit

### Constraint

The system supports a **maximum of 24 tags** total.

This limit exists because:
1. Each tag must have a unique color
2. The color palette contains 24 distinct colors
3. Color uniqueness is a database constraint

### When Limit is Reached

**Scenario**: Attempting to import a CSV that would create the 25th tag

**Error message:**
```
❌ Import failed

Cannot create tag "newtag": Maximum number of tags (24) reached.
No available colors.
```

**Import behavior:**
- Import is **completely blocked** (not partial)
- No sessions are imported
- Database remains unchanged
- User receives clear error message

**Solutions:**

1. **Delete unused tags** to free up colors:
   - Go to tag management
   - Delete tags that are no longer needed
   - Re-import the CSV

2. **Consolidate tags** in the CSV:
   - Edit the CSV to use existing tag names
   - Combine similar tags into broader categories
   - Re-import with consolidated tags

3. **Split the import**:
   - Remove some tags from the CSV
   - Import in multiple batches
   - Manually reassign tags later if needed

## User Experience

### Toast Notifications

**Complete success with tag creation:**
```
✅ Import successful

5 sessions imported successfully.
Created 3 new tag(s): fitness, education, cooking
```

**Partial success with tag creation:**
```
⚠️ Import completed with issues

3 sessions imported successfully
2 new tag(s) created: reading, meditation
1 duplicate skipped
```

**Max tags error:**
```
❌ Import failed

Cannot create tag "hobby": Maximum number of tags (24) reached.
No available colors.
```

### Information Display

The toast notifications provide:
- **Count**: Number of tags created
- **Names**: List of created tag names (up to reasonable limit)
- **Color**: Green text to indicate successful creation
- **Persistence**: Tags are permanently added to database

## Example Scenarios

### Scenario 1: Importing Backup from Another Device

**Device A state:**
```
Tags: routine, sleep, work, exercise, reading
```

**Device B (fresh install):**
```
Tags: (empty)
```

**Import CSV from Device A:**

**Result:**
- ✅ All 5 tags automatically created
- ✅ Colors assigned from palette
- ✅ All sessions imported with correct tags
- 📊 Import summary: "Created 5 new tag(s): routine, sleep, work, exercise, reading"

### Scenario 2: Partial Tag Overlap

**Database state:**
```
Tags: routine, sleep, work
```

**Import CSV containing:**
```csv
Tag
routine    ← Exists
fitness    ← NEW
education  ← NEW
sleep      ← Exists
cooking    ← NEW
```

**Result:**
- ✅ 3 new tags created: fitness, education, cooking
- ✅ 2 existing tags reused: routine, sleep
- ✅ All sessions imported successfully
- 📊 Import summary: "Created 3 new tag(s): fitness, education, cooking"

### Scenario 3: Maximum Tags Limit

**Database state:**
```
Tags: 22 existing tags (22 colors used)
```

**Import CSV containing:**
```csv
Tag
existing1  ← Exists
existing2  ← Exists
newtag1    ← NEW (would be #23)
newtag2    ← NEW (would be #24)
newtag3    ← NEW (would be #25) ❌ EXCEEDS LIMIT
```

**Result:**
- ❌ Import blocked completely
- ❌ No sessions imported
- ❌ No tags created
- 🚫 Error: "Maximum number of tags (24) reached"

**Solution:**
1. Delete 1 unused tag from database
2. Re-import (all 3 new tags will fit)

## Implementation Details

### Functions

**`extractUniqueTags(dataRows: string[][]): string[]`**
- Scans CSV rows and extracts unique tag names
- Returns array of tag names to process

**`createMissingTags(tagNames: string[]): Promise<string[]>`**
- Checks each tag against database
- Creates missing tags with available colors
- Returns array of created tag names
- Throws error if color limit reached

### Error Handling

**Color limit reached:**
```typescript
if (availableColors.length === 0) {
  throw new Error(
    `Cannot create tag "${tagName}": Maximum number of tags (24) reached. No available colors.`
  );
}
```

**Database errors:**
- Wrapped in try-catch
- Import fails gracefully
- User receives specific error message
- Database remains in consistent state

### Performance

**Efficiency measures:**
- Tags created in batch before sessions
- Single query for available colors
- Sequential tag creation (prevents color conflicts)
- Minimal database round-trips

**Expected timing:**
- Tag extraction: < 10ms (even for 1000 rows)
- Tag creation: ~50ms per tag
- Total overhead: Negligible for typical imports

## Benefits

### 1. Zero Configuration

✅ **Before**: Users had to manually create tags before importing
❌ **Now**: Tags are created automatically

### 2. Data Portability

✅ Export from one device → Import to another device seamlessly
✅ No manual tag setup needed on new device
✅ Colors assigned automatically

### 3. Backup Restoration

✅ Full restore without manual intervention
✅ All tags recreated with proper colors
✅ Sessions import with correct tag references

### 4. Error Prevention

✅ No "tag not found" warnings
✅ No sessions importing without tags
✅ Clear error messages when limits reached

## Migration from Old Behavior

### Old Behavior (Before This Update)

When importing a CSV with a tag that didn't exist:
- ⚠️ Warning: "Tag 'tagname' not found. Session will be imported without tag."
- Session imported with `tag: null`
- User had to manually create tag and re-import

### New Behavior (Current)

When importing a CSV with a tag that doesn't exist:
- ✅ Tag is automatically created
- ✅ Color assigned from available palette
- ✅ Session imports with correct tag reference
- 📊 User informed: "Created 1 new tag(s): tagname"

### No Breaking Changes

- Existing imports still work
- Old CSVs work exactly the same
- No changes needed to CSV format
- Only behavior enhancement (better UX)

## Testing

### Test File: `test-import-new-tags.csv`

Contains 5 sessions with 5 unique tags:
```csv
Date,Time,Title,Duration (seconds),Rating,Comment,Tag,State
27/01/2026,09:00:00,Morning workout,3600,4,Great cardio,fitness,completed
27/01/2026,11:00:00,Study session,7200,5,Productive learning,education,completed
27/01/2026,14:30:00,Project work,5400,4,Good progress,development,completed
27/01/2026,18:00:00,Cooking dinner,1800,3,Healthy meal,cooking,completed
27/01/2026,20:00:00,Reading book,3600,5,Very engaging,reading,completed
```

**Expected result (empty database):**
- ✅ 5 sessions imported
- ✅ 5 tags created: fitness, education, development, cooking, reading
- ✅ Each tag has unique color from palette
- 📊 Import summary shows all created tags

## Future Considerations

### Possible Enhancements (Not Implemented)

1. **User-Selected Colors**: Allow users to choose colors during import
   - ❌ Rejected: Would require interactive UI, breaks batch import flow

2. **Color Preferences in CSV**: Include color column in CSV
   - ❌ Rejected: Increases CSV complexity, may conflict with existing colors

3. **Tag Merging**: Combine similar tags (e.g., "work" and "Work")
   - ❌ Rejected: Case sensitivity is intentional, allows distinct tags

4. **Unlimited Tags**: Remove 24-tag limit
   - ❌ Rejected: Color uniqueness is core to tag UX, limit is by design

The current implementation (automatic creation with sequential color assignment) was chosen as the simplest and most user-friendly approach.
