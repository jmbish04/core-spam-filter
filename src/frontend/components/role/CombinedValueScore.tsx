"use client";

import { ScaleIcon, RefreshCcwIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { apiGet, apiPost, toast } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CombinedInsight {
  id: string;
  roleId: string;
  version: number;
  type: string;
  score: number;
  rationale: string;
  analysisPayload: {
    locationScore?: number;
    compensationScore?: number;
  } | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 75) return "hsl(142, 71%, 45%)";
  if (score >= 40) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 40) return "Moderate";
  return "Low";
}

// ---------------------------------------------------------------------------
// CombinedValueScore
// ---------------------------------------------------------------------------

export function CombinedValueScore({ roleId }: { roleId: string }) {
  const [insight, setInsight] = useState<CombinedInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<CombinedInsight>(`/api/roles/${roleId}/insights?type=combined`);
      setInsight(data);
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    try {
      await apiPost(`/api/roles/${roleId}/insights`, {
        types: ["location", "compensation", "combined"],
      });
      toast({ title: "Full analysis complete" });
      await load();
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center rounded-lg p-8">
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card className="rounded-lg">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <ScaleIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No combined analysis yet.</p>
          <Button size="sm" disabled={analyzing} onClick={() => void analyze()}>
            {analyzing ? (
              <>
                <Loader2Icon className="mr-1 h-3 w-3 animate-spin" /> Analyzing…
              </>
            ) : (
              "Run Full Analysis"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const color = getScoreColor(insight.score);
  const chartData = [{ name: "score", value: insight.score, fill: color }];
  const chartConfig: ChartConfig = { score: { label: "Value", color } };
  const endAngle = (insight.score / 100) * 360;
  const payload = insight.analysisPayload;

  return (
    <Card className="flex flex-col rounded-lg">
      <CardHeader className="flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Combined Value</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            v{insight.version}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={analyzing}
            onClick={() => void analyze()}
          >
            {analyzing ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcwIcon className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-0">
        {/* Sub-scores */}
        {payload && (
          <div className="mb-3 flex justify-center gap-3">
            {payload.locationScore != null && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Location
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: getScoreColor(payload.locationScore) }}
                >
                  {payload.locationScore}
                </p>
              </div>
            )}
            {payload.compensationScore != null && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Compensation
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: getScoreColor(payload.compensationScore) }}
                >
                  {payload.compensationScore}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Radial gauge */}
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[180px]">
          <RadialBarChart
            data={chartData}
            startAngle={0}
            endAngle={endAngle}
            innerRadius={65}
            outerRadius={80}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[80, 65]}
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
                          {insight.score}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          {getScoreLabel(insight.score)}
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

      <CardFooter className="flex-col gap-2 px-4 pt-3 text-sm">
        <p className="text-center leading-relaxed text-muted-foreground">{insight.rationale}</p>
      </CardFooter>
    </Card>
  );
}
