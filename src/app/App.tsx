import { useState, useEffect, useRef } from "react";
import { Timer, ChartBar, History } from "lucide-react";
import { toast } from "sonner";
import { Stopwatch } from "./components/Stopwatch";
import { SessionDialog } from "./components/SessionDialog";
import { DailySummary, Session } from "./components/DailySummary";
import { HistoricalData } from "./components/HistoricalData";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";

const STORAGE_KEY = "agamotto_sessions";
const STOPGAP_KEY = "agamotto_stopgap";
const TIMER_STATE_KEY = "agamotto_timer_state";
const DEFAULT_STOPGAP = 60 * 60 * 1000; // 1 hour in milliseconds

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentView, setCurrentView] = useState<
    "timer" | "today" | "historical"
  >("timer");
  const [showDialog, setShowDialog] = useState(false);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [defaultStopgap, setDefaultStopgap] = useState(DEFAULT_STOPGAP);

  // Lifted timer state to persist across view changes
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timestamp-based timing for accurate background tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedTime, setAccumulatedTime] = useState(0);

  // Timer interval effect - timestamp-based for accurate background tracking
  useEffect(() => {
    if (isRunning && !isPaused) {
      // Set start time if not already set
      if (!startTime) {
        setStartTime(Date.now());
      }

      // Update time display based on elapsed time since start
      intervalRef.current = setInterval(() => {
        if (startTime) {
          const elapsed = Date.now() - startTime + accumulatedTime;
          setTime(elapsed);
        }
      }, 10);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, startTime, accumulatedTime]);

  // Load sessions, stopgap, and timer state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSessions(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored sessions", e);
      }
    }

    const storedStopgap = localStorage.getItem(STOPGAP_KEY);
    if (storedStopgap) {
      try {
        setDefaultStopgap(parseInt(storedStopgap, 10));
      } catch (e) {
        console.error("Failed to parse stored stopgap", e);
      }
    }

    // Restore timer state if it exists
    const storedTimerState = localStorage.getItem(TIMER_STATE_KEY);
    if (storedTimerState) {
      try {
        const state = JSON.parse(storedTimerState);
        if (state.isRunning || state.isPaused) {
          // Calculate time elapsed including background time
          const elapsed = state.accumulatedTime || 0;
          setAccumulatedTime(elapsed);
          setTime(elapsed);
          setIsPaused(state.isPaused);
          setIsRunning(state.isRunning);

          // If timer was running (not paused), set new start time to now
          if (state.isRunning && !state.isPaused) {
            setStartTime(Date.now());
          }
        }
      } catch (e) {
        console.error("Failed to restore timer state", e);
      }
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  // Handle pause/resume logic - update accumulated time when pausing
  useEffect(() => {
    if (isPaused && startTime) {
      // When pausing, calculate and save accumulated time
      const elapsed = Date.now() - startTime + accumulatedTime;
      setAccumulatedTime(elapsed);
      setTime(elapsed);
      setStartTime(null);
    } else if (isRunning && !isPaused && !startTime) {
      // When resuming from pause, set new start time
      setStartTime(Date.now());
    }
  }, [isRunning, isPaused]);

  // Page Visibility API - handle app backgrounding/foregrounding
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background - save current state with elapsed time
        if (isRunning && !isPaused && startTime) {
          const elapsed = Date.now() - startTime + accumulatedTime;
          setAccumulatedTime(elapsed);
          setTime(elapsed);
        }
      } else {
        // App came to foreground - resume with new start time
        if (isRunning && !isPaused) {
          setStartTime(Date.now());
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, isPaused, startTime, accumulatedTime]);

  // Persist timer state to localStorage
  useEffect(() => {
    if (isRunning || isPaused) {
      // Calculate current accumulated time if running
      const currentAccumulated =
        isRunning && !isPaused && startTime
          ? Date.now() - startTime + accumulatedTime
          : accumulatedTime;

      const timerState = {
        isRunning,
        isPaused,
        accumulatedTime: currentAccumulated,
      };

      localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
    } else {
      // Clear timer state when stopped
      localStorage.removeItem(TIMER_STATE_KEY);
      setStartTime(null);
      setAccumulatedTime(0);
    }
  }, [isRunning, isPaused, startTime, accumulatedTime, time]);

  const handleStopwatchComplete = (duration: number) => {
    setPendingDuration(duration);
    setShowDialog(true);
  };

  const handleSaveSession = (data: {
    title: string;
    rating: number;
    comment: string;
  }) => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: data.title,
      duration: pendingDuration,
      rating: data.rating,
      comment: data.comment,
      timestamp: Date.now(),
    };

    setSessions((prev) => [...prev, newSession]);
    setShowDialog(false);
    setPendingDuration(0);
    toast.success("Session saved.");
  };

  const handleCancelSession = () => {
    setShowDialog(false);
    setPendingDuration(0);
  };

  const handleDiscardSession = () => {
    setShowDialog(false);
    setPendingDuration(0);
    toast.error("Session discarded.");
  };

  const handleStopgapChange = (stopgap: number) => {
    setDefaultStopgap(stopgap);
    localStorage.setItem(STOPGAP_KEY, String(stopgap));
  };

  const handleExportCSV = () => {
    if (sessions.length === 0) return;

    const headers = [
      "Date",
      "Time",
      "Title",
      "Duration (seconds)",
      "Rating",
      "Comment",
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
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen flex flex-col pb-32 md:pb-0">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-[1200px] mx-auto px-6 py-4 flex justify-between items-center md:flex-row flex-col">
            <h1 className="font-bold text-2xl">agamotto</h1>
            <p className="opacity-60">time tracking without the bullshit</p>
          </div>
        </header>

        {/* Navigation - Desktop */}
        <nav className="border-b bg-background hidden md:block">
          <div className="max-w-[1200px] mx-auto px-6 py-2 flex gap-2">
            <Button
              variant={currentView === "timer" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("timer")}
              className="gap-2"
            >
              <Timer className="h-4 w-4" />
              Timer
            </Button>
            <Button
              variant={currentView === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("today")}
              className="gap-2"
            >
              <ChartBar className="h-4 w-4" />
              Today's Insights
            </Button>
            <Button
              variant={currentView === "historical" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("historical")}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Historical Data
            </Button>
          </div>
        </nav>

        {/* Navigation - Mobile (Bottom) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden p-5 z-50">
          <div className="flex justify-around items-center ">
            <Button
              variant={currentView === "timer" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("timer")}
              className="flex-col py-2 pr-2 gap-1 w-18 h-18"
            >
              <Timer className="h-9 w-9" />
              <span className="text-xs">
                Timer <br />{" "}
              </span>
            </Button>
            <Button
              variant={currentView === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("today")}
              className="flex-col py-2 px-2 gap-1 w-18 h-18"
            >
              <ChartBar className="h-9 w-9" />
              <span className="text-xs">
                Today's
                <br />
                Insights
              </span>
            </Button>
            <Button
              variant={currentView === "historical" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("historical")}
              className="flex-col pl-2 px-2 gap-1 w-18 h-18"
            >
              <History className="h-9 w-9" />
              <span className="text-xs">
                Historical
                <br />
                Data
              </span>
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-[1200px] mx-auto w-full">
          {currentView === "timer" ? (
            <Stopwatch
              onComplete={handleStopwatchComplete}
              defaultStopgap={defaultStopgap}
              onStopgapChange={handleStopgapChange}
              time={time}
              setTime={setTime}
              isRunning={isRunning}
              setIsRunning={setIsRunning}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />
          ) : currentView === "today" ? (
            <div className="py-6">
              <DailySummary sessions={sessions} />
            </div>
          ) : (
            <div className="py-6">
              <HistoricalData sessions={sessions} onExport={handleExportCSV} />
            </div>
          )}
        </main>

        {/* Session Dialog */}
        <SessionDialog
          open={showDialog}
          duration={pendingDuration}
          onSave={handleSaveSession}
          onCancel={handleCancelSession}
          onDiscard={handleDiscardSession}
        />
      </div>
    </>
  );
}

export default App;
