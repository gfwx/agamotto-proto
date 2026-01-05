import type { Session } from "./db/appSessionUtil";

/**
 * Export sessions to CSV file
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
    "State",
  ];

  const rows = sessions.map((session) => {
    const date = new Date(session.timestamp);
    return [
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      session.title,
      Math.floor(session.duration / 1000),
      session.rating,
      session.comment.replace(/"/g, '""'), // Escape quotes
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
