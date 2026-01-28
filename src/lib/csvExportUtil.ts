import type { Session } from "./db/appSessionUtil";

/**
 * Export sessions to CSV file
 *
 * Exports in DD/MM/YYYY date format with 24-hour time (HH:MM:SS).
 * This format is compatible with the CSV import function.
 *
 * Example date/time: "27/01/2026" and "14:30:00" for Jan 27, 2026 at 2:30 PM
 */
export function exportSessionsToCSV(sessions: Session[]): void {
  if (sessions.length === 0) return;

  const headers = [
    "Date",
    "Time",
    "Title",
    "Duration (seconds)",
    "Rating",
    "Comment",
    "Tag",
    "State",
  ];

  const rows = sessions.map((session) => {
    const date = new Date(session.timestamp);

    // Format date as DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const dateStr = `${day}/${month}/${year}`;

    // Format time as HH:MM:SS
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const timeStr = `${hours}:${minutes}:${seconds}`;

    return [
      dateStr,
      timeStr,
      session.title,
      Math.floor(session.duration / 1000),
      session.rating,
      session.comment.replace(/"/g, '""'), // Escape quotes
      session.tag?.name || "",
      session.state,
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `agamotto_export_${Date.now()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
