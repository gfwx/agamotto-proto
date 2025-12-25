import { useState, useMemo } from 'react';
import { Download, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Session } from './DailySummary';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface HistoricalDataProps {
  sessions: Session[];
  onExport: () => void;
}

type ViewMode = 'hourly' | 'weekly' | 'custom';

export function HistoricalData({ sessions, onExport }: HistoricalDataProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('hourly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (viewMode) {
      case 'hourly':
        start = new Date(now);
        start.setMinutes(0, 0, 0);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else {
          start = new Date(now);
          start.setHours(0, 0, 0, 0);
        }
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  const timelineFilteredSessions = useMemo(() => {
    return sessions.filter(
      (session) => session.timestamp >= start.getTime() && session.timestamp <= end.getTime()
    );
  }, [sessions, start, end]);

  const ganttData = useMemo(() => {
    return timelineFilteredSessions.map((session) => {
      const sessionStart = new Date(session.timestamp);
      const sessionEnd = new Date(session.timestamp + session.duration);
      
      return {
        id: session.id,
        title: session.title,
        start: sessionStart,
        end: sessionEnd,
        duration: session.duration,
        rating: session.rating,
        y: sessionStart.getDate() + sessionStart.getMonth() * 31,
      };
    });
  }, [timelineFilteredSessions]);

  // Daily tables show ALL sessions, not filtered by view period
  const sessionsByDay = useMemo(() => {
    const grouped = new Map<string, Session[]>();
    
    sessions.forEach((session) => {
      const date = new Date(session.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
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
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getHourFromDate = (date: Date) => {
    return date.getHours() + date.getMinutes() / 60;
  };

  const formatHour = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m > 0 ? `${displayHour}:${m.toString().padStart(2, '0')}${period}` : `${displayHour}${period}`;
  };

  return (
    <div className="space-y-6 pb-6">
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
        <div className="px-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative min-h-[200px] overflow-x-auto">
                <div className="relative" style={{ minWidth: '600px' }}>
                  {/* Time grid */}
                  <div className="flex border-b border-gray-200 pb-2 mb-4">
                    {Array.from({ length: 25 }, (_, i) => (
                      <div key={i} className="flex-1 text-xs text-center text-muted-foreground">
                        {i}
                      </div>
                    ))}
                  </div>

                  {/* Session bars */}
                  <div className="space-y-2">
                    {ganttData.map((item) => {
                      const startHour = getHourFromDate(item.start);
                      const durationHours = item.duration / (1000 * 60 * 60);
                      const leftPercent = (startHour / 24) * 100;
                      const widthPercent = (durationHours / 24) * 100;

                      return (
                        <div key={item.id} className="relative h-10">
                          <div
                            className="absolute h-8 rounded bg-primary/80 hover:bg-primary transition-colors flex items-center px-2 overflow-hidden"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                            title={`${item.title} - ${formatTime(item.start)} to ${formatTime(item.end)}`}
                          >
                            <span className="text-xs text-primary-foreground truncate">
                              {item.title}
                            </span>
                          </div>
                          <div className="absolute left-0 top-0 h-8 flex items-center text-xs text-muted-foreground">
                            {formatTime(item.start)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Period Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={viewMode === 'hourly' ? 'default' : 'outline'}
                  onClick={() => setViewMode('hourly')}
                >
                  Hourly
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'weekly' ? 'default' : 'outline'}
                  onClick={() => setViewMode('weekly')}
                >
                  Weekly
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'custom' ? 'default' : 'outline'}
                  onClick={() => setViewMode('custom')}
                >
                  Custom
                </Button>
              </div>

              {viewMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date" className="text-xs">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
            const totalDuration = daySessions.reduce((sum, s) => sum + s.duration, 0);
            return (
              <Card key={dateKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{dateKey}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(totalDuration)} • {daySessions.length} sessions
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
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatTime(new Date(session.timestamp))}
                            {' • '}
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