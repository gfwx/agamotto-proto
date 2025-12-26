import { useState, useEffect } from "react";
import { Play, Pause, Square, Clock } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface StopwatchProps {
  onComplete: (duration: number) => void;
  defaultStopgap: number;
  onStopgapChange: (stopgap: number) => void;
  time: number;
  setTime: (time: number | ((prev: number) => number)) => void;
  isRunning: boolean;
  setIsRunning: (isRunning: boolean) => void;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
}

export function Stopwatch({
  onComplete,
  defaultStopgap,
  onStopgapChange,
  time,
  setTime,
  isRunning,
  setIsRunning,
  isPaused,
  setIsPaused,
}: StopwatchProps) {
  const [showStopgapDialog, setShowStopgapDialog] = useState(false);
  const [sessionStopgap, setSessionStopgap] = useState(defaultStopgap);
  const [stopgapValue, setStopgapValue] = useState(
    String(defaultStopgap / 60000),
  ); // Convert ms to minutes
  const [stopgapUnit, setStopgapUnit] = useState<"minutes" | "hours">(
    "minutes",
  );

  // Check if stopgap reached
  useEffect(() => {
    if (isRunning && sessionStopgap > 0 && time >= sessionStopgap) {
      setIsRunning(false);
      const duration = time;
      setTime(0);
      setIsPaused(false);
      setSessionStopgap(defaultStopgap);
      onComplete(duration);
    }
  }, [time, sessionStopgap, isRunning, onComplete, defaultStopgap, setIsRunning, setTime, setIsPaused]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const handleStartPause = () => {
    if (!isRunning && !isPaused) {
      // Start
      setIsRunning(true);
    } else if (isRunning) {
      // Pause
      setIsRunning(false);
      setIsPaused(true);
    } else {
      // Resume
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    const duration = time;
    setTime(0);
    setIsPaused(false);
    setSessionStopgap(defaultStopgap); // Reset to default for next session
    onComplete(duration);
  };

  const handleSaveStopgap = () => {
    const value = parseFloat(stopgapValue) || 0;
    const milliseconds =
      stopgapUnit === "hours" ? value * 60 * 60 * 1000 : value * 60 * 1000;

    // Clamp to 24 hours max
    const clampedMs = Math.min(milliseconds, 24 * 60 * 60 * 1000);

    setSessionStopgap(clampedMs);
    onStopgapChange(clampedMs);
    setShowStopgapDialog(false);
  };

  const getStopgapDisplay = () => {
    if (sessionStopgap === 0) return "No limit";
    const minutes = Math.floor(sessionStopgap / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const hasStarted = time > 0 || isRunning;
  const stopgapProgress =
    sessionStopgap > 0 ? (time / sessionStopgap) * 100 : 0;
  const isStopgapReached = sessionStopgap > 0 && time >= sessionStopgap;

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="mb-12">
          <div
            className={`text-6xl font-mono tracking-tight text-center transition-colors ${isStopgapReached ? "text-red-500" : ""}`}
          >
            {formatTime(time)}
          </div>
          {sessionStopgap > 0 && hasStarted && (
            <div className="mt-4 w-64 mx-auto">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isStopgapReached ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(stopgapProgress, 100)}%` }}
                />
              </div>
              <div className="text-xs text-center text-muted-foreground mt-1">
                Maximum session time: {getStopgapDisplay()}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 items-center">
          <Button
            size="lg"
            onClick={handleStartPause}
            className="h-20 w-20 rounded-full p-0"
          >
            {isRunning ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>

          {hasStarted && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleStop}
              className="h-16 w-16 rounded-full p-0"
            >
              <Square className="h-6 w-6" />
            </Button>
          )}
        </div>

        {!hasStarted ? (
          <div className="mt-8 text-center space-y-3 flex items-center flex-col">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStopgapDialog(true)}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              {getStopgapDisplay()}
            </Button>
            <p className="text-sm text-muted-foreground">
              Maximum session time
            </p>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStopgapDialog(true)}
            className="mt-8 gap-2"
          >
            <Clock className="h-4 w-4" />
            Change limit
          </Button>
        )}
      </div>

      {/* Stopgap Configuration Dialog */}
      <Dialog open={showStopgapDialog} onOpenChange={setShowStopgapDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Session Time Limit</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set a time limit for this session. The stopwatch will
              automatically stop when reached.
            </p>

            <div className="space-y-2">
              <Label htmlFor="stopgap-value">Time Limit</Label>
              <div className="flex gap-2">
                <Input
                  id="stopgap-value"
                  type="number"
                  min="0"
                  max={stopgapUnit === "hours" ? "24" : "1440"}
                  value={stopgapValue}
                  onChange={(e) => setStopgapValue(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                <Select
                  value={stopgapUnit}
                  onValueChange={(value: "minutes" | "hours") => {
                    setStopgapUnit(value);
                    // Convert value when switching units
                    const currentValue = parseFloat(stopgapValue) || 0;
                    if (value === "hours" && stopgapUnit === "minutes") {
                      setStopgapValue(String(currentValue / 60));
                    } else if (value === "minutes" && stopgapUnit === "hours") {
                      setStopgapValue(String(currentValue * 60));
                    }
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum: 24 hours. Set to 0 for no limit.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowStopgapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStopgap}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
