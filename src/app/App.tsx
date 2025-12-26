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

  // Timer interval effect - runs regardless of which view is active
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
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
  }, [isRunning]);

  // Load sessions and stopgap from localStorage on mount
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
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

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
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden mb-[36px] z-50">
          <div className="flex justify-around items-end px-4 py-3">
            <Button
              variant={currentView === "timer" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("timer")}
              className="flex-col h-auto py-2 px-3 gap-1"
            >
              <Timer className="h-9 w-9" />
              <span className="text-xs">Timer</span>
            </Button>
            <Button
              variant={currentView === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("today")}
              className="flex-col h-auto py-2 px-3 gap-1"
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
              className="flex-col h-auto py-2 px-3 gap-1"
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
