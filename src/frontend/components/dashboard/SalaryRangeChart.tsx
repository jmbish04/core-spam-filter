import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api-client";

import type { SalaryChartRow } from "./types";

type SalaryPoint = SalaryChartRow & { midpoint: number | null };

export function SalaryRangeChart() {
  const [rows, setRows] = useState<SalaryChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const points = useMemo<SalaryPoint[]>(
    () =>
      rows.map((row) => ({
        ...row,
        midpoint:
          row.min !== null && row.max !== null
            ? Math.round((row.min + row.max) / 2)
            : (row.min ?? row.max),
      })),
    [rows],
  );
  const hasSalary = points.some((point) => point.midpoint !== null);

  useEffect(() => {
    apiGet<SalaryChartRow[]>("/api/dashboard/by-salary")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Salary Range</CardTitle>
        <CardDescription>Midpoints from saved role compensation data.</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <div className="h-full rounded-md bg-muted/50" />
        ) : !hasSalary ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
            No salary data has been captured yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ left: -6, right: 12, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `$${Number(value) / 1000}k`}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: 8,
                }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Midpoint"]}
              />
              <Line
                type="monotone"
                dataKey="midpoint"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
