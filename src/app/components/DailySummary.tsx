import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Clock, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tag } from "./ui/tag";
import type { Session } from "../../lib/db/appSessionUtil";

interface DailySummaryProps {
  sessions: Session[];
}

export function DailySummary({ sessions }: DailySummaryProps) {
  const todayData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimestamp = tomorrow.getTime();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTimestamp = yesterday.getTime();

    const todaySessions = sessions.filter(
      (session) =>
        session.timestamp >= todayTimestamp && session.state === "completed",
    );

    // Find last completed sleep session (most recent)
    const lastSleepSession = sessions.find(
      (session) =>
        session.state === "completed" &&
        session.tag?.name.toLowerCase() === "sleep",
    );

    // Group by hour with tag color tracking
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour,
      duration: 0,
      sessions: [] as Session[],
      tagColors: new Map<string, number>(), // Map of color to duration
    }));

    todaySessions.forEach((session) => {
      const sessionDate = new Date(session.timestamp);
      const hour = sessionDate.getHours();
      hourlyData[hour].duration += session.duration;
      hourlyData[hour].sessions.push(session);

      // Track tag colors and their durations
      const color = session.tag?.color || "#9CA3AF"; // Gray for untagged
      const currentDuration = hourlyData[hour].tagColors.get(color) || 0;
      hourlyData[hour].tagColors.set(color, currentDuration + session.duration);
    });

    // Sessions created today or carried over from yesterday
    const todayOrCarriedOverSessions = sessions.filter((session) => {
      if (session.state !== "completed") return false;

      const sessionStart = session.timestamp;
      const sessionEnd = session.timestamp + session.duration;

      // Created today
      if (sessionStart >= todayTimestamp && sessionStart < tomorrowTimestamp) {
        return true;
      }

      // Started yesterday but ended today (carried over)
      if (
        sessionStart >= yesterdayTimestamp &&
        sessionStart < todayTimestamp &&
        sessionEnd >= todayTimestamp
      ) {
        return true;
      }

      return false;
    });

    // Calculate tag duration distribution for pie chart
    const tagDurations = new Map<string, { duration: number; color: string }>();
    let untaggedDuration = 0;

    todayOrCarriedOverSessions.forEach((session) => {
      if (session.tag) {
        const existing = tagDurations.get(session.tag.name) || {
          duration: 0,
          color: session.tag.color,
        };
        tagDurations.set(session.tag.name, {
          duration: existing.duration + session.duration,
          color: session.tag.color,
        });
      } else {
        untaggedDuration += session.duration;
      }
    });

    // Convert to array for recharts
    const pieChartData = Array.from(tagDurations.entries()).map(
      ([name, data]) => ({
        name,
        value: data.duration,
        color: data.color,
      }),
    );

    // Add untagged sessions if any
    if (untaggedDuration > 0) {
      pieChartData.push({
        name: "Untagged",
        value: untaggedDuration,
        color: "#9CA3AF",
      });
    }

    // Sort by duration descending
    pieChartData.sort((a, b) => b.value - a.value);

    return {
      todaySessions,
      hourlyData: hourlyData.filter((h) => h.duration > 0),
      totalDuration: todaySessions.reduce((sum, s) => sum + s.duration, 0),
      avgRating:
        todaySessions.length > 0
          ? todaySessions.reduce((sum, s) => sum + s.rating, 0) /
            todaySessions.length
          : 0,
      lastSleepSession,
      pieChartData,
    };
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

  const formatHour = (hour: number) => {
    if (hour === 0) return "12am";
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return "12pm";
    return `${hour - 12}pm`;
  };

  const formatPieChartDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
  };

  const getBarColor = (hourData: {
    hour: number;
    duration: number;
    sessions: Session[];
    tagColors: Map<string, number>;
  }) => {
    // Find the tag with the longest duration for this hour
    let maxDuration = 0;
    let dominantColor = "#9CA3AF"; // Default gray for untagged

    hourData.tagColors.forEach((duration, color) => {
      if (duration > maxDuration) {
        maxDuration = duration;
        dominantColor = color;
      }
    });

    return dominantColor;
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between px-6">
        <h2 className="text-2xl">Today's Summary</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl">
                {formatDuration(todayData.totalDuration)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{todayData.todaySessions.length}</div>
          </CardContent>
        </Card>
      </div>

      {todayData.lastSleepSession && (
        <div className="px-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Last Sleep Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <Moon className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl">
                  {formatDuration(todayData.lastSleepSession.duration)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {new Date(todayData.lastSleepSession.timestamp).toLocaleString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {todayData.pieChartData.length > 0 && (
        <div className="px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today's Sessions by Tag</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" aspect={1}>
                <PieChart>
                  <Pie
                    data={todayData.pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {todayData.pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="vertical"
                    formatter={(value, entry: any) => {
                      const totalDuration = todayData.pieChartData.reduce(
                        (sum, d) => sum + d.value,
                        0,
                      );
                      const percentage = (
                        (entry.payload.value / totalDuration) *
                        100
                      ).toFixed(1);
                      return `${value} (${formatPieChartDuration(entry.payload.value)} | ${percentage}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
      {todayData.hourlyData.length > 0 ? (
        <div className="px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity Throughout Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={todayData.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatDuration(value)}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatDuration(value)}
                    labelFormatter={(hour) => formatHour(hour as number)}
                  />
                  <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                    {todayData.hourlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="px-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No sessions recorded today yet
            </CardContent>
          </Card>
        </div>
      )}
      {todayData.todaySessions.length > 0 && (
        <div className="px-6 space-y-3">
          <h3 className="font-medium">Recent Sessions</h3>
          <div className="space-y-2">
            {todayData.todaySessions
              .slice()
              .reverse()
              .map((session) => (
                <Card key={session.id}>
                  <CardContent className="py-3">
                    <div className="flex justify-between items-start">
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
                          {formatDuration(session.duration)}
                          {" • "}
                          {new Date(session.timestamp).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                        </div>
                        {session.comment && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
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
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
