import { RefreshCw } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HealthDashboard() {
  const [health, setHealth] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data: any = await res.json();
        setHealth(data.modules);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">System Modules</h2>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {health.map((item, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.module}</CardTitle>
              <Badge
                variant={item.status === "Healthy" ? "default" : "destructive"}
                className={
                  item.status === "Healthy" ? "bg-green-500 hover:bg-green-600 text-white" : ""
                }
              >
                {item.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mt-2">
                Latency: <span className="font-mono">{item.latency_ms}ms</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Last Check: {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
