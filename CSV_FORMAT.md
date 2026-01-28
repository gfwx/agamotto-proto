# CSV Import/Export Format

This document describes the CSV format used by Agamotto for importing and exporting session data.

## File Format

### Headers (Required)

```
Date,Time,Title,Duration (seconds),Rating,Comment,Tag,State
```

### Column Specifications

| Column | Format | Required | Description | Example |
|--------|--------|----------|-------------|---------|
| **Date** | DD/MM/YYYY | ✅ Yes | Date in day/month/year format | `27/01/2026` |
| **Time** | HH:MM:SS | ✅ Yes | Time in 24-hour format | `14:30:00` |
| **Title** | String | ✅ Yes | Session title (non-empty) | `Morning workout` |
| **Duration (seconds)** | Number | ✅ Yes | Session duration in seconds | `3600` |
| **Rating** | Number (0-5) | ✅ Yes | Session rating (0-5 range) | `4` |
| **Comment** | String | ❌ No | Any text (can be empty) | `Great session` |
| **Tag** | String | ❌ No | Tag name (must exist in DB, or empty) | `routine` |
| **State** | String | ✅ Yes | Session state (see below) | `completed` |

### Valid States

| State | Can Import? | Description |
|-------|-------------|-------------|
| `completed` | ✅ Yes | Finished session |
| `aborted` | ✅ Yes | Discarded session |
| `not_started` | ✅ Yes | Initial state |
| `active` | ❌ **NO** | Currently running - CANNOT be imported |
| `paused` | ❌ **NO** | Currently paused - CANNOT be imported |

> ⚠️ **CRITICAL**: Active and paused sessions cannot be imported because the system only allows one active/paused session at a time. Any CSV containing active or paused sessions will be rejected during validation.

## Example CSV Files

### Valid Import

```csv
Date,Time,Title,Duration (seconds),Rating,Comment,Tag,State
27/01/2026,09:00:00,Morning workout,3600,4,Great cardio session,routine,completed
27/01/2026,14:30:00,Afternoon nap,5400,5,Very refreshing,sleep,completed
27/01/2026,18:00:00,Project work,7200,3,Made good progress,work,completed
```

### Date Format Examples

```csv
Date,Time,Title,Duration (seconds),Rating,Comment,Tag,State
01/01/2026,09:00:00,New Year's Day,3600,5,Starting the year right,routine,completed
15/03/2026,14:30:00,Mid-month session,5400,4,Good progress,work,completed
31/12/2025,23:45:00,New Year's Eve,1800,5,Last session of the year,sleep,completed
29/02/2024,12:00:00,Leap day session,7200,3,Rare day,work,completed
```

## Import Process

1. **File Selection**: Click "Import CSV" button in Historical Data view
2. **Validation**: CSV is validated for:
   - Correct headers
   - Correct column count per row
   - Valid date format (DD/MM/YYYY)
   - Valid time format
   - Valid data types (duration as number, rating 0-5)
   - Valid states (no active/paused sessions)
   - Required fields not empty
3. **Tag Matching**: Tags are matched with existing tags in database
   - If tag not found: Session imports without tag (warning shown)
4. **Import Execution**: Valid sessions are imported to database
5. **Results**: Toast notification shows success/failure summary

## Export Process

1. Click "Export CSV" button in Historical Data view
2. All **completed** sessions are exported
3. File is downloaded as `agamotto_export_[timestamp].csv`
4. Format matches import requirements (DD/MM/YYYY, 24-hour time)

## Data Compatibility

- ✅ **Export → Import**: Full round-trip compatibility
- ✅ **Cross-device**: Export from one device, import on another
- ✅ **Backup**: Use export for data backup
- ✅ **Migration**: Move data between installations

## Error Handling

### Validation Errors (Import Blocked)

- Invalid file type (not .csv)
- Missing or incorrect headers
- Wrong number of columns
- Invalid date format (not DD/MM/YYYY)
- Invalid time format
- Duration not a number
- Rating not in 0-5 range
- Invalid state value
- Active or paused sessions present
- Missing required fields

### Import Warnings (Import Proceeds)

- Tag not found in database (session imports without tag)
- Partial success (some rows failed, others succeeded)

### Visual Feedback

All errors and warnings are shown via toast notifications:
- ❌ **Error**: Red toast with error details (blocks import)
- ⚠️ **Warning**: Yellow toast with warnings (import proceeds)
- ✅ **Success**: Green toast with success count

## Technical Notes

### Date Parsing

- Uses custom DD/MM/YYYY parser to avoid locale issues
- JavaScript's Date object is used internally (months are 0-indexed)
- Leap years are handled automatically

### Time Parsing

- 24-hour format (HH:MM:SS)
- Hours: 00-23
- Minutes: 00-59
- Seconds: 00-59

### CSV Parsing

- Handles quoted fields with embedded commas
- Handles escaped quotes (" becomes "")
- Trims whitespace from field values
- Skips empty lines

### Session IDs

- Imported sessions get unique IDs: `imported_[timestamp]_[index]_[random]`
- Original IDs are not preserved (prevents conflicts)

## Test Files

The repository includes test CSV files:

1. **test-import.csv** - Valid sessions for testing successful import
2. **test-import-invalid.csv** - Various validation errors
3. **test-import-active-session.csv** - Demonstrates active/paused rejection
4. **test-import-date-formats.csv** - Various date formats and edge cases

## Troubleshooting

### "CSV validation failed"

- Check that date is in DD/MM/YYYY format (day first, not month)
- Ensure all required columns are present
- Verify rating is between 0-5
- Check that state is valid (and not "active" or "paused")

### "Tag not found" warning

- The tag name in the CSV doesn't exist in your database
- Session will still import, but without the tag
- Create the tag first, then re-import if needed

### "Cannot import active sessions"

- CSV contains a session with state "active" or "paused"
- Change these to "completed" or "aborted" before importing
- This is a system constraint to maintain data integrity
