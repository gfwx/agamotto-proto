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
} from "recharts";
import { Clock } from "lucide-react";
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

    const todaySessions = sessions.filter(
      (session) =>
        session.timestamp >= todayTimestamp && session.state === "completed",
    );

    // Group by hour
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour,
      duration: 0,
      sessions: [] as Session[],
    }));

    todaySessions.forEach((session) => {
      const sessionDate = new Date(session.timestamp);
      const hour = sessionDate.getHours();
      hourlyData[hour].duration += session.duration;
      hourlyData[hour].sessions.push(session);
    });

    return {
      todaySessions,
      hourlyData: hourlyData.filter((h) => h.duration > 0),
      totalDuration: todaySessions.reduce((sum, s) => sum + s.duration, 0),
      avgRating:
        todaySessions.length > 0
          ? todaySessions.reduce((sum, s) => sum + s.rating, 0) /
            todaySessions.length
          : 0,
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

  const getBarColor = (hour: number) => {
    if (hour < 6) return "hsl(var(--muted))";
    if (hour < 12) return "hsl(var(--primary))";
    if (hour < 18) return "hsl(var(--primary))";
    return "hsl(var(--muted-foreground))";
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
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(entry.hour)}
                      />
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
