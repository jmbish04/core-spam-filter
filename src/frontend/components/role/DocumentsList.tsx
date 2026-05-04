import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api-client";

import type { DocumentRow } from "../dashboard/types";

export function DocumentsList({ roleId }: { roleId: string }) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DocumentRow[]>(`/api/documents?roleId=${encodeURIComponent(roleId)}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [roleId]);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Generated and manually linked Google Docs for this role.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 rounded-md bg-muted/50" />
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No documents are linked yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {rows.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{document.name}</div>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="secondary">{document.type}</Badge>
                    <Badge variant="outline">v{document.version}</Badge>
                  </div>
                </div>
                <a
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-2.5 text-sm font-medium transition hover:bg-muted"
                  href={`https://docs.google.com/document/d/${document.gdocId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
