import { useState, useMemo, useRef } from "react";
import { toPng } from "html-to-image";
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
import {
  Clock,
  TrendingUp,
  BarChart as BarChartIcon,
  Activity,
  ArrowDown,
  ArrowUp,
  Info,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import type { Session } from "../../lib/db/appSessionUtil";
import {
  getTagDailyDurations,
  groupSessionsByDay,
  calculateDayTotals,
  filterDaysByCompleteness,
  calculateStatistics,
  calculateZScores,
  createDistributionData,
  calculatePercentile,
  formatDuration,
  formatZScore,
  getDayKey,
  removeOutliers,
} from "../../lib/statisticsUtil";

interface AdvancedStatisticsProps {
  sessions: Session[];
}

export default function AdvancedStatistics({
  sessions,
}: AdvancedStatisticsProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tolerancePercentile, setTolerancePercentile] = useState<number>(0);
  const [removeOutliersEnabled, setRemoveOutliersEnabled] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Get list of tags that have at least one completed session
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    sessions.forEach((session) => {
      if (session.state === "completed" && session.tag) {
        tagSet.add(session.tag.name);
      }
    });
    return Array.from(tagSet).sort();
  }, [sessions]);

  // Calculate total hours per day across all tags
  const allDayTotals = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.state === "completed");
    const sessionsByDay = groupSessionsByDay(completedSessions);
    return calculateDayTotals(sessionsByDay);
  }, [sessions]);

  // Get daily data for selected tag with completeness filtering
  const rawFilteredDayData = useMemo(() => {
    if (!selectedTag) return [];

    const dayData = getTagDailyDurations(sessions, selectedTag);
    return filterDaysByCompleteness(dayData, allDayTotals, tolerancePercentile);
  }, [sessions, selectedTag, tolerancePercentile, allDayTotals]);

  // Apply outlier removal if enabled
  const { filteredDayData, outliersRemoved } = useMemo(() => {
    if (!removeOutliersEnabled) {
      return { filteredDayData: rawFilteredDayData, outliersRemoved: 0 };
    }

    const result = removeOutliers(rawFilteredDayData);
    return { filteredDayData: result.filtered, outliersRemoved: result.removed };
  }, [rawFilteredDayData, removeOutliersEnabled]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const durations = filteredDayData.map((d) => d.duration);
    return calculateStatistics(durations);
  }, [filteredDayData]);

  // Calculate z-scores
  const zScores = useMemo(() => {
    return calculateZScores(filteredDayData, statistics);
  }, [filteredDayData, statistics]);

  // Create distribution data for chart
  const distributionData = useMemo(() => {
    return createDistributionData(zScores, 20);
  }, [zScores]);

  // Get today's comparison data
  const todayComparison = useMemo(() => {
    if (!selectedTag) return null;

    const today = getDayKey(Date.now());
    const todayData = filteredDayData.find((d) => d.date === today);

    if (!todayData) {
      return null;
    }

    const allDurations = filteredDayData.map((d) => d.duration);
    const percentile = calculatePercentile(todayData.duration, allDurations);
    const zScore =
      statistics.standardDeviation > 0
        ? (todayData.duration - statistics.mean) / statistics.standardDeviation
        : 0;

    // Context message based on percentile
    let contextMessage = "";
    if (percentile < 25) {
      contextMessage = "⬇ Below average for this tag";
    } else if (percentile < 50) {
      contextMessage = "↘ Slightly below median";
    } else if (percentile < 75) {
      contextMessage = "↗ Above median";
    } else {
      contextMessage = "⬆ Well above average";
    }

    return {
      duration: todayData.duration,
      zScore,
      percentile,
      contextMessage,
    };
  }, [selectedTag, filteredDayData, statistics]);

  // Calculate filter info (included/excluded days)
  const filterInfo = useMemo(() => {
    if (!selectedTag) return { included: 0, excluded: 0 };

    const allDayData = getTagDailyDurations(sessions, selectedTag);
    const included = filteredDayData.length;
    const excluded = allDayData.length - included;

    return { included, excluded };
  }, [sessions, selectedTag, filteredDayData]);

  // Get selected tag object for color
  const selectedTagObj = useMemo(() => {
    if (!selectedTag) return null;
    const session = sessions.find(
      (s) => s.state === "completed" && s.tag?.name === selectedTag,
    );
    return session?.tag || null;
  }, [selectedTag, sessions]);

  // Export statistics as image
  const handleExportImage = async () => {
    if (!exportRef.current || !selectedTag) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2, // Higher quality
      });

      // Download the image
      const link = document.createElement("a");
      link.download = `agamotto-stats-${selectedTag}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="px-6">
        <h2 className="text-2xl">Advanced Statistics</h2>
      </div>

      {/* Controls Section */}
      <div className="px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analysis Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tag Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Tag</label>
              <Select value={selectedTag || ""} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tag to analyze..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map((tagName) => {
                    const tagSession = sessions.find(
                      (s) => s.tag?.name === tagName,
                    );
                    const tagColor = tagSession?.tag?.color || "#9CA3AF";
                    return (
                      <SelectItem key={tagName} value={tagName}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tagColor }}
                          />
                          <span>{tagName}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Tolerance Filter */}
            {selectedTag && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Minimum Day Completeness: {tolerancePercentile}th percentile
                  </label>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Info className="h-4 w-4" />
                  </div>
                </div>
                <Slider
                  value={[tolerancePercentile]}
                  onValueChange={(value) => setTolerancePercentile(value[0])}
                  min={0}
                  max={100}
                  step={5}
                />
                <div className="text-xs text-muted-foreground">
                  {filterInfo.included} days included, {filterInfo.excluded}{" "}
                  days excluded
                </div>
                <div className="text-xs text-muted-foreground">
                  Filters based on total daily hours across all tags
                </div>
              </div>
            )}

            {/* Outlier Removal */}
            {selectedTag && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remove-outliers"
                    checked={removeOutliersEnabled}
                    onCheckedChange={(checked) =>
                      setRemoveOutliersEnabled(checked === true)
                    }
                  />
                  <label
                    htmlFor="remove-outliers"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remove extreme outliers (IQR method)
                  </label>
                </div>
                {outliersRemoved > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {outliersRemoved} outlier(s) removed from analysis
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Uses Interquartile Range (IQR) to identify and exclude extreme values
                </div>
              </div>
            )}

            {/* Export Button */}
            {selectedTag && statistics.count > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export Statistics as Image"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {!selectedTag && (
        <div className="px-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a tag to view statistics</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Statistics Grid */}
      {selectedTag && statistics.count > 0 && (
        <div ref={exportRef} className="space-y-6">
          {/* Export Header */}
          <div className="px-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-semibold">{selectedTag} Statistics</h3>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="px-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Mean */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Mean
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {formatDuration(statistics.mean)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Median */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Median
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {formatDuration(statistics.median)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Mode */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <BarChartIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {statistics.mode !== null
                        ? formatDuration(statistics.mode)
                        : "N/A"}
                    </span>
                  </div>
                  {statistics.mode === null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      No repeating values
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Standard Deviation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Std Deviation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {formatDuration(statistics.standardDeviation)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Min */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Min
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <ArrowDown className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {formatDuration(statistics.min)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Max */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Max
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <ArrowUp className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl">
                      {formatDuration(statistics.max)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Distribution Chart */}
          {statistics.count > 1 && (
            <div className="px-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Z-Score Distribution</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    Shows how each day deviates from the mean
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="zScore"
                        tickFormatter={(value) => formatZScore(value)}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        label={{
                          value: "Days",
                          angle: -90,
                          position: "insideLeft",
                        }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} days`, "Count"]}
                        labelFormatter={(value) => `Z-Score: ${formatZScore(value)}`}
                      />
                      <Bar dataKey="frequency" radius={[4, 4, 0, 0]}>
                        {distributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={selectedTagObj?.color || "#8884d8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Single data point warning */}
          {statistics.count === 1 && (
            <div className="px-6">
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  Distribution requires multiple days of data
                </CardContent>
              </Card>
            </div>
          )}

          {/* Today's Comparison */}
          {todayComparison && (
            <div className="px-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Today's Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-2xl font-semibold">
                      Today: {formatDuration(todayComparison.duration)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatZScore(todayComparison.zScore)}{" "}
                      {todayComparison.zScore >= 0 ? "above" : "below"} mean
                    </div>
                    <div className="text-sm font-medium">
                      {todayComparison.percentile.toFixed(0)}th percentile
                    </div>
                  </div>

                  {/* Progress bar visualization */}
                  <div className="relative w-full h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute h-full rounded-full transition-all"
                      style={{
                        width: `${todayComparison.percentile}%`,
                        backgroundColor: selectedTagObj?.color || "#8884d8",
                      }}
                    />
                  </div>

                  {/* Context message */}
                  <div className="text-sm font-medium text-center p-3 bg-muted rounded-lg">
                    {todayComparison.contextMessage}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No data for today */}
          {!todayComparison && statistics.count > 0 && (
            <div className="px-6">
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">
                  No time tracked today for {selectedTag}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* No data state */}
      {selectedTag && statistics.count === 0 && (
        <div className="px-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {filterInfo.excluded > 0 ? (
                <>
                  <p className="mb-2">
                    Tolerance threshold too high. {filterInfo.excluded} days
                    excluded.
                  </p>
                  <p className="text-sm">
                    Lower the threshold to include more days in the analysis.
                  </p>
                </>
              ) : (
                <p>No completed sessions for {selectedTag}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insufficient data warning */}
      {selectedTag && statistics.count > 0 && statistics.count < 3 && (
        <div className="px-6">
          <Card className="border-yellow-500/50">
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              <Info className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
              Need more data for reliable percentile calculations (at least 3
              days recommended)
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
