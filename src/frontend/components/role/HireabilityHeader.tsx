"use client";

import {
  RefreshCcwIcon,
  Loader2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

import { AnalysisConfigModal } from "./AnalysisConfigModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalysisRow {
  id: string;
  roleId: string;
  version: number;
  hireScore: number;
  hireRationale: string;
  compensationScore: number;
  compensationRationale: string;
  configNotebooklmPrompt: string | null;
  configCompensationBaseline: string | null;
  configCareerStories: string | null;
  usedDefaults: boolean | null;
  analyzedAt: string;
}

interface AnalysisData {
  analysis: AnalysisRow;
  totalRevisions: number;
  alignmentScores: Array<{
    id: string;
    type: string;
    content: string;
    score: number;
    rationale: string;
  }>;
}

interface RevisionSummary {
  id: string;
  version: number;
  hireScore: number;
  compensationScore: number;
  usedDefaults: boolean | null;
  analyzedAt: string;
}

interface HireabilityHeaderProps {
  roleId: string;
}

// ---------------------------------------------------------------------------
// Score color helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 75) return "hsl(142, 71%, 45%)"; // Green — strong
  if (score >= 40) return "hsl(38, 92%, 50%)"; // Amber — moderate
  return "hsl(0, 84%, 60%)"; // Red — gap
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 40) return "Moderate";
  return "Low";
}

// ---------------------------------------------------------------------------
// Radial gauge chart config
// ---------------------------------------------------------------------------

function buildChartConfig(label: string, color: string): ChartConfig {
  return {
    score: { label, color },
  };
}

// ---------------------------------------------------------------------------
// Radial Score Card
// ---------------------------------------------------------------------------

function RadialScoreCard({
  title,
  description,
  score,
  rationale,
}: {
  title: string;
  description: string;
  score: number;
  rationale: string;
}) {
  const color = getScoreColor(score);
  const chartData = [{ name: "score", value: score, fill: color }];
  const chartConfig = buildChartConfig(title, color);
  // Map score (0-100) to end angle (0-360)
  const endAngle = (score / 100) * 360;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
          <RadialBarChart
            data={chartData}
            startAngle={0}
            endAngle={endAngle}
            innerRadius={70}
            outerRadius={85}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[85, 70]}
            />
            <RadialBar dataKey="value" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {score}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-sm"
                        >
                          {getScoreLabel(score)}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm px-4">
        <p className="text-muted-foreground text-center leading-relaxed line-clamp-3">
          {rationale}
        </p>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// HireabilityHeader — exported component
// ---------------------------------------------------------------------------

export function HireabilityHeader({ roleId }: HireabilityHeaderProps) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch latest analysis
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`/api/roles/${roleId}/analysis`);
      if (res.ok) {
        setData((await res.json()) as AnalysisData);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  // Fetch revision history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/roles/${roleId}/analysis/history`);
      if (res.ok) {
        const json = (await res.json()) as { revisions?: AnalysisRow[] };
        setRevisions(
          (json.revisions ?? []).map((r: AnalysisRow) => ({
            id: r.id,
            version: r.version,
            hireScore: r.hireScore,
            compensationScore: r.compensationScore,
            usedDefaults: r.usedDefaults,
            analyzedAt: r.analyzedAt,
          })),
        );
      }
    } catch {
      // silent
    }
  }, [roleId]);

  // Fetch a specific analysis by ID
  const fetchAnalysis = useCallback(
    async (analysisId: string) => {
      try {
        const res = await fetch(`/api/roles/${roleId}/analysis/${analysisId}`);
        if (res.ok) {
          setData((await res.json()) as AnalysisData);
        }
      } catch {
        // silent
      }
    },
    [roleId],
  );

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      await fetch(`/api/roles/${roleId}/analysis`, { method: "POST" });
      // Poll for results
      const pollInterval = setInterval(async () => {
        const res = await fetch(`/api/roles/${roleId}/analysis`);
        if (res.ok) {
          const result = (await res.json()) as AnalysisData;
          if (result.analysis) {
            setData(result);
            setAnalyzing(false);
            clearInterval(pollInterval);
            // Refresh history
            fetchHistory();
          }
        }
      }, 3000);
      // Max poll 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setAnalyzing(false);
      }, 120_000);
    } catch {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    fetchHistory();
  }, [fetchLatest, fetchHistory]);

  // Navigation helpers
  const currentVersion = data?.analysis.version ?? 0;
  const totalRevisions = revisions.length;
  const isLatest = currentVersion === Math.max(...revisions.map((r) => r.version), 0);
  const currentRevIdx = revisions.findIndex((r) => r.version === currentVersion);

  const goToPrev = () => {
    if (currentRevIdx < revisions.length - 1) {
      fetchAnalysis(revisions[currentRevIdx + 1].id);
    }
  };
  const goToNext = () => {
    if (currentRevIdx > 0) {
      fetchAnalysis(revisions[currentRevIdx - 1].id);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="flex flex-col items-center justify-center min-h-[280px]">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </Card>
        <Card className="flex flex-col items-center justify-center min-h-[280px]">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <p className="text-muted-foreground text-sm">
            No hireability analysis available for this role yet.
          </p>
          <Button variant="outline" onClick={triggerAnalysis} disabled={analyzing}>
            {analyzing ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Analyzing…
              </>
            ) : (
              "Run Analysis"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const analysis = data.analysis;

  return (
    <div className="mb-6 space-y-3">
      {/* Header bar: title, revision nav, buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Hireability Analysis</h3>
          {totalRevisions > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              v{currentVersion}
              {isLatest ? " — Latest" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AnalysisConfigModal
            version={analysis.version}
            analyzedAt={analysis.analyzedAt}
            configNotebooklmPrompt={analysis.configNotebooklmPrompt}
            configCompensationBaseline={analysis.configCompensationBaseline}
            configCareerStories={analysis.configCareerStories}
            usedDefaults={analysis.usedDefaults}
          />
          <Button variant="outline" size="sm" onClick={triggerAnalysis} disabled={analyzing}>
            {analyzing ? (
              <Loader2Icon className="size-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCcwIcon className="size-4 mr-1.5" />
            )}
            Re-analyze Role
          </Button>
        </div>
      </div>

      {/* Revision navigation */}
      {totalRevisions > 1 && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground flex-1">
            {totalRevisions} analysis revision{totalRevisions !== 1 ? "s" : ""} available. Viewing v
            {currentVersion} of {totalRevisions}.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrev}
            disabled={currentRevIdx >= revisions.length - 1}
            className="h-7 px-2"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={currentRevIdx <= 0}
            className="h-7 px-2"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Fallback warning */}
      {analysis.usedDefaults && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-400">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>
              This analysis used default configuration values because no custom config was saved.{" "}
              <a href="/config" className="underline underline-offset-2 hover:text-amber-300">
                Update your config
              </a>{" "}
              with your career stories and compensation details, then click{" "}
              <strong>Re-analyze Role</strong> to generate updated scores using your custom prompts.
            </p>
          </div>
        </div>
      )}

      {/* Radial score cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RadialScoreCard
          title="Hire Likelihood"
          description="Overall fit assessment"
          score={analysis.hireScore}
          rationale={analysis.hireRationale}
        />
        <RadialScoreCard
          title="Compensation"
          description="Relative to baseline"
          score={analysis.compensationScore}
          rationale={analysis.compensationRationale}
        />
      </div>
    </div>
  );
}
