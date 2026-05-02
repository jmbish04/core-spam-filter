import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatsRow({ stats }: { stats: any }) {
  const safeCount = stats.total - stats.spam_count;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Spam Blocked</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.spam_count}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Safe Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{safeCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.alert_count}</div>
        </CardContent>
      </Card>
    </div>
  );
}
