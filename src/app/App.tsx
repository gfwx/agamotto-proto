import { useState, useEffect, useRef } from "react";
import { Timer, ChartBar, History } from "lucide-react";
import { toast } from "sonner";
import { Stopwatch } from "./components/Stopwatch";
import { SessionDialog } from "./components/SessionDialog";
import { DailySummary } from "./components/DailySummary";
import { HistoricalData } from "./components/HistoricalData";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import type { Session } from "../lib/sessions";
import {
  initDatabase,
  saveSession,
  getActiveSession,
  getSessionsByState,
  saveConfig,
  getConfig,
  getAllConfig,
} from "../lib/db";
import { exportSessionsToCSV } from "../lib/csv";
import { setupDebugAPI } from "../lib/debug";

const DEFAULT_STOPGAP = 0;

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentView, setCurrentView] = useState<
    "timer" | "today" | "historical"
  >("timer");
  const [showDialog, setShowDialog] = useState(false);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [defaultStopgap, setDefaultStopgap] = useState(DEFAULT_STOPGAP);

  // Timer state
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer interval effect - updates display every 10ms
  useEffect(() => {
    if (isRunning && !isPaused && currentSession) {
      intervalRef.current = setInterval(async () => {
        const pauseTime = (await getConfig("pauseTime")) || 0;
        const elapsed = Date.now() - (currentSession.timestamp + pauseTime);
        setTime(elapsed);
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
  }, [isRunning, isPaused, currentSession]);

  // Initialize IndexedDB and load data on mount
  useEffect(() => {
    async function initialize() {
      try {
        // Initialize IndexedDB
        await initDatabase();

        // Setup debug API
        setupDebugAPI();

        // Load config
        const config = await getAllConfig();
        setDefaultStopgap(config.defaultStopgap || 0);

        // Check for active session
        const activeSession = await getActiveSession();

        if (activeSession) {
          setCurrentSession(activeSession);

          // Restore timer state
          if (activeSession.state === "active") {
            setIsRunning(true);
            setIsPaused(false);

            // Calculate current elapsed time
            const pauseTime = config.pauseTime || 0;
            const elapsed = Date.now() - (activeSession.timestamp + pauseTime);
            setTime(elapsed);
          } else if (activeSession.state === "paused") {
            setIsRunning(false);
            setIsPaused(true);

            // Calculate elapsed time at pause
            const pauseTime = config.pauseTime || 0;
            const elapsed = Date.now() - (activeSession.timestamp + pauseTime);
            setTime(elapsed);
          }
        } else {
          // Create not_started session
          const newSession: Session = {
            id: crypto.randomUUID(),
            title: "",
            duration: 0,
            rating: 0,
            comment: "",
            timestamp: Date.now(),
            state: "not_started",
          };
          await saveSession(newSession);
          setCurrentSession(newSession);
        }

        // Load completed sessions for analytics
        const completedSessions = await getSessionsByState("completed");
        setSessions(completedSessions);
      } catch (error) {
        console.error("Initialization failed:", error);
        toast.error("Failed to initialize app");
      }
    }

    initialize();
  }, []);


  // Page Visibility API - handle app backgrounding/foregrounding
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && isRunning && !isPaused && currentSession) {
        // App came to foreground - update time display
        const pauseTime = (await getConfig("pauseTime")) || 0;
        const elapsed = Date.now() - (currentSession.timestamp + pauseTime);
        setTime(elapsed);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, isPaused, currentSession]);

  const handleStart = async () => {
    if (!currentSession) return;

    try {
      const updatedSession: Session = {
        ...currentSession,
        timestamp: Date.now(), // Set creation time
        state: "active",
      };

      await saveSession(updatedSession);
      setCurrentSession(updatedSession);
      setIsRunning(true);
      setIsPaused(false);
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error("Failed to start timer");
    }
  };

  const handlePause = async () => {
    if (!currentSession) return;

    try {
      await saveConfig("lastPausedTimestamp", Date.now());

      const updatedSession: Session = {
        ...currentSession,
        state: "paused",
      };

      await saveSession(updatedSession);
      setCurrentSession(updatedSession);
      setIsRunning(false);
      setIsPaused(true);
    } catch (error) {
      console.error("Failed to pause session:", error);
      toast.error("Failed to pause timer");
    }
  };

  const handleResume = async () => {
    if (!currentSession) return;

    try {
      const lastPausedTimestamp = await getConfig("lastPausedTimestamp");
      const currentPauseTime = (await getConfig("pauseTime")) || 0;

      if (lastPausedTimestamp) {
        const pauseDuration = Date.now() - lastPausedTimestamp;
        await saveConfig("pauseTime", currentPauseTime + pauseDuration);
        await saveConfig("lastPausedTimestamp", null);
      }

      const updatedSession: Session = {
        ...currentSession,
        state: "active",
      };

      await saveSession(updatedSession);
      setCurrentSession(updatedSession);
      setIsRunning(true);
      setIsPaused(false);
    } catch (error) {
      console.error("Failed to resume session:", error);
      toast.error("Failed to resume timer");
    }
  };

  const handleStopwatchComplete = (duration: number) => {
    setPendingDuration(duration);
    setShowDialog(true);
  };

  const handleSaveSession = async (data: {
    title: string;
    rating: number;
    comment: string;
  }) => {
    if (!currentSession) return;

    try {
      const pauseTime = (await getConfig("pauseTime")) || 0;
      const finalDuration = Date.now() - currentSession.timestamp - pauseTime;

      const completedSession: Session = {
        ...currentSession,
        title: data.title,
        duration: finalDuration,
        rating: data.rating,
        comment: data.comment,
        state: "completed",
      };

      await saveSession(completedSession);

      // Reset pause tracking
      await saveConfig("pauseTime", 0);
      await saveConfig("lastPausedTimestamp", null);

      // Create new not_started session
      const newSession: Session = {
        id: crypto.randomUUID(),
        title: "",
        duration: 0,
        rating: 0,
        comment: "",
        timestamp: Date.now(),
        state: "not_started",
      };
      await saveSession(newSession);
      setCurrentSession(newSession);

      // Reset timer UI
      setTime(0);
      setIsRunning(false);
      setIsPaused(false);

      // Refresh analytics
      const completedSessions = await getSessionsByState("completed");
      setSessions(completedSessions);

      setShowDialog(false);
      setPendingDuration(0);
      toast.success("Session saved.");
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error("Failed to save session");
    }
  };

  const handleCancelSession = () => {
    setShowDialog(false);
    setPendingDuration(0);
  };

  const handleDiscardSession = async () => {
    if (!currentSession) return;

    try {
      const pauseTime = (await getConfig("pauseTime")) || 0;
      const finalDuration = Date.now() - currentSession.timestamp - pauseTime;

      const abortedSession: Session = {
        ...currentSession,
        duration: finalDuration,
        state: "aborted",
      };

      await saveSession(abortedSession);

      // Reset pause tracking
      await saveConfig("pauseTime", 0);
      await saveConfig("lastPausedTimestamp", null);

      // Create new not_started session
      const newSession: Session = {
        id: crypto.randomUUID(),
        title: "",
        duration: 0,
        rating: 0,
        comment: "",
        timestamp: Date.now(),
        state: "not_started",
      };
      await saveSession(newSession);
      setCurrentSession(newSession);

      // Reset timer UI
      setTime(0);
      setIsRunning(false);
      setIsPaused(false);

      setShowDialog(false);
      setPendingDuration(0);
      toast.error("Session discarded.");
    } catch (error) {
      console.error("Failed to discard session:", error);
      toast.error("Failed to discard session");
    }
  };

  const handleStopgapChange = async (stopgap: number) => {
    setDefaultStopgap(stopgap);
    await saveConfig("defaultStopgap", stopgap);
  };

  const handleExportCSV = async () => {
    try {
      const completedSessions = await getSessionsByState("completed");
      exportSessionsToCSV(completedSessions);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Failed to export data");
    }
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
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              defaultStopgap={defaultStopgap}
              onStopgapChange={handleStopgapChange}
              time={time}
              isRunning={isRunning}
              isPaused={isPaused}
              currentSession={currentSession}
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
