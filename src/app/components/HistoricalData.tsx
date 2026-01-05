import { useState, useMemo, useRef, useEffect } from "react";
import { Download, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tag } from "./ui/tag";
import type { Session } from "../../lib/db/appSessionUtil";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

interface HistoricalDataProps {
  sessions: Session[];
  onExport: () => void;
}

type ViewMode = "hourly" | "weekly" | "custom";

export function HistoricalData({ sessions, onExport }: HistoricalDataProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("hourly");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100); // 100% = default, up to 1000% for minute precision
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredSession, setHoveredSession] = useState<{
    session: Session;
    x: number;
    y: number;
  } | null>(null);

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (viewMode) {
      case "hourly":
        // Show only today's sessions
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "weekly":
        // Show last 7 days
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        // Show custom date range
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else {
          // Default to today if dates not set
          start = new Date(now);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
        }
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  const timelineFilteredSessions = useMemo(() => {
    return sessions.filter(
      (session) =>
        session.timestamp >= start.getTime() &&
        session.timestamp <= end.getTime() &&
        session.state === "completed",
    );
  }, [sessions, start, end]);

  const ganttData = useMemo(() => {
    // Group sessions by day
    const grouped = new Map<string, typeof timelineFilteredSessions>();

    timelineFilteredSessions.forEach((session) => {
      const date = new Date(session.timestamp);
      const dateKey = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    });

    // Convert to array and sort by date (most recent first)
    return Array.from(grouped.entries())
      .sort((a, b) => {
        const dateA = new Date(a[1][0].timestamp);
        const dateB = new Date(b[1][0].timestamp);
        return dateB.getTime() - dateA.getTime();
      })
      .map(([dateKey, sessions]) => ({
        dateKey,
        sessions: sessions.map((session) => ({
          id: session.id,
          title: session.title,
          start: new Date(session.timestamp),
          end: new Date(session.timestamp + session.duration),
          duration: session.duration,
          rating: session.rating,
        })),
      }));
  }, [timelineFilteredSessions]);

  // Daily tables show ALL completed sessions, not filtered by view period
  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, Session[]>();

    sessions.forEach((session) => {
      // Only show completed sessions
      if (session.state !== "completed") return;

      const date = new Date(session.timestamp);
      const dateKey = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(session);
    });

    return Array.from(grouped.entries()).sort((a, b) => {
      const dateA = new Date(a[1][0].timestamp);
      const dateB = new Date(b[1][0].timestamp);
      return dateB.getTime() - dateA.getTime();
    });
  }, [sessions]);

  const formatDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Calculate time scale based on zoom level
  const getTimeScale = () => {
    if (zoomLevel >= 800) {
      // 800-1000%: Show every minute
      return {
        unit: "minute",
        count: 1440,
        label: (i: number) => {
          const h = Math.floor(i / 60);
          const m = i % 60;
          if (m % 15 === 0) {
            // Show label every 15 minutes
            return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          }
          return "";
        },
      };
    } else if (zoomLevel >= 400) {
      // 400-799%: Show every 5 minutes
      return {
        unit: "5min",
        count: 288,
        label: (i: number) => {
          const totalMinutes = i * 5;
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          if (m % 30 === 0) {
            // Show label every 30 minutes
            return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          }
          return "";
        },
      };
    } else if (zoomLevel >= 200) {
      // 200-399%: Show every 15 minutes
      return {
        unit: "15min",
        count: 96,
        label: (i: number) => {
          const totalMinutes = i * 15;
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        },
      };
    } else {
      // 100-199%: Show every hour
      return {
        unit: "hour",
        count: 24,
        label: (i: number) => {
          return `${i.toString().padStart(2, "0")}:00`;
        },
      };
    }
  };

  const timeScale = getTimeScale();
  const baseTimelineWidth = 1200; // Base width for timeline area at 100%
  const timelineWidth = (baseTimelineWidth * zoomLevel) / 100;
  const dateLabelWidth = 128; // w-32 = 8rem = 128px
  const totalWidth = timelineWidth + dateLabelWidth;

  // Auto-center on current time when zooming
  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentTimePosition = (currentMinutes / 1440) * timelineWidth;

      // Center the scroll on the current time position
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollLeft =
        currentTimePosition + dateLabelWidth - containerWidth / 2;

      scrollContainerRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [zoomLevel, timelineWidth, dateLabelWidth]);

  const handleSessionHover = (session: Session, event: React.MouseEvent) => {
    setHoveredSession({
      session,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleSessionLeave = () => {
    setHoveredSession(null);
  };

  const handleMouseMove = (session: Session, event: React.MouseEvent) => {
    if (hoveredSession?.session.id === session.id) {
      setHoveredSession({
        session,
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  return (
    <div className="space-y-6 pb-6 relative">
      {/* Floating Session Details Dialog */}
      {hoveredSession && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${hoveredSession.x + 15}px`,
            top: `${hoveredSession.y + 15}px`,
          }}
        >
          <Card className="shadow-lg border-2 min-w-[280px] max-w-[400px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {hoveredSession.session.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hoveredSession.session.tag && (
                <div className="mb-2">
                  <Tag
                    name={hoveredSession.session.tag.name}
                    color={hoveredSession.session.tag.color}
                  />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start:</span>
                <span className="font-medium">
                  {formatTime(new Date(hoveredSession.session.timestamp))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {formatDuration(hoveredSession.session.duration)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End:</span>
                <span className="font-medium">
                  {formatTime(
                    new Date(
                      hoveredSession.session.timestamp +
                        hoveredSession.session.duration,
                    ),
                  )}
                </span>
              </div>
              {hoveredSession.session.rating > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rating:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">
                      {hoveredSession.session.rating}
                    </span>
                    <span className="text-yellow-400">★</span>
                  </div>
                </div>
              )}
              {hoveredSession.session.comment && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">
                    Comment:
                  </span>
                  <p className="text-sm">{hoveredSession.session.comment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl">Historical Data</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={sessions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Gantt Chart */}
      {ganttData.length > 0 ? (
        <div className="px-6 space-y-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm">Timeline View</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Zoom: {zoomLevel}%
                </span>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-32"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={scrollContainerRef}
                className="relative min-h-[200px] overflow-x-auto overflow-y-hidden"
              >
                <div className="relative" style={{ width: `${totalWidth}px` }}>
                  {/* Time grid */}
                  <div className="flex border-b border-gray-200 pb-2 mb-4 sticky top-0 bg-background z-10">
                    <div
                      className="flex-shrink-0"
                      style={{ width: `${dateLabelWidth}px` }}
                    ></div>
                    <div
                      className="flex"
                      style={{ width: `${timelineWidth}px` }}
                    >
                      {Array.from({ length: timeScale.count }, (_, i) => {
                        const label = timeScale.label(i);
                        const cellWidth = timelineWidth / timeScale.count;
                        return (
                          <div
                            key={i}
                            className="text-xs text-center text-muted-foreground border-l border-gray-100 first:border-l-0"
                            style={{ width: `${cellWidth}px` }}
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Session bars grouped by day */}
                  <div className="space-y-4">
                    {ganttData.map((dayData) => (
                      <div key={dayData.dateKey} className="flex">
                        {/* Date label */}
                        <div
                          className="flex-shrink-0 text-xs font-medium text-muted-foreground flex items-start pt-1 sticky left-0 bg-background"
                          style={{ width: `${dateLabelWidth}px` }}
                        >
                          {dayData.dateKey}
                        </div>

                        {/* Timeline for this day */}
                        <div
                          className="relative"
                          style={{
                            width: `${timelineWidth}px`,
                            height: `${dayData.sessions.length * 32}px`,
                            minHeight: "32px",
                          }}
                        >
                          {dayData.sessions.map((item, idx) => {
                            const startMinutes =
                              item.start.getHours() * 60 +
                              item.start.getMinutes();
                            const durationMinutes = item.duration / (1000 * 60);
                            const leftPx =
                              (startMinutes / 1440) * timelineWidth;
                            const widthPx =
                              (durationMinutes / 1440) * timelineWidth;

                            // Find the original session object for this item
                            const originalSession = sessions.find(
                              (s) => s.id === item.id,
                            )!;

                            return (
                              <div
                                key={item.id}
                                className="absolute h-7 rounded bg-primary/80 hover:bg-primary transition-colors flex items-center px-2 overflow-hidden cursor-pointer"
                                style={{
                                  left: `${leftPx}px`,
                                  width: `${widthPx}px`,
                                  top: `${idx * 32}px`,
                                }}
                                onMouseEnter={(e) =>
                                  handleSessionHover(originalSession, e)
                                }
                                onMouseMove={(e) =>
                                  handleMouseMove(originalSession, e)
                                }
                                onMouseLeave={handleSessionLeave}
                              >
                                <span className="text-xs text-primary-foreground truncate">
                                  {item.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Period Controls */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="text-sm font-medium">Timeline Period</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === "hourly" ? "default" : "outline"}
                onClick={() => setViewMode("hourly")}
              >
                Hourly
              </Button>
              <Button
                size="sm"
                variant={viewMode === "weekly" ? "default" : "outline"}
                onClick={() => setViewMode("weekly")}
              >
                Weekly
              </Button>
              <Button
                size="sm"
                variant={viewMode === "custom" ? "default" : "outline"}
                onClick={() => setViewMode("custom")}
              >
                Custom
              </Button>
            </div>

            {viewMode === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sessions recorded for timeline view</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Tables */}
      {sessionsByDay.length > 0 ? (
        <div className="px-6 space-y-4">
          {sessionsByDay.map(([dateKey, daySessions]) => {
            const totalDuration = daySessions.reduce(
              (sum, s) => sum + s.duration,
              0,
            );
            return (
              <Card key={dateKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{dateKey}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(totalDuration)} • {daySessions.length}{" "}
                      sessions
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex justify-between items-start p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{session.title}</div>
                          {session.tag && (
                            <div className="mt-1">
                              <Tag
                                name={session.tag.name}
                                color={session.tag.color}
                              />
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatTime(new Date(session.timestamp))}
                            {" • "}
                            {formatDuration(session.duration)}
                          </div>
                          {session.comment && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {session.comment}
                            </div>
                          )}
                        </div>
                        {session.rating > 0 && (
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <span className="text-sm">{session.rating}</span>
                            <span className="text-yellow-400">★</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="px-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sessions recorded in this period</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
