import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryParam } from "@/hooks/use-query-param";
import { apiGet } from "@/lib/api-client";

import type { EmailRow, RoleRow } from "../dashboard/types";

import { Thread } from "../assistant-ui/thread";
import { AlignmentBreakdown } from "./AlignmentBreakdown";
import { CombinedValueScore } from "./CombinedValueScore";
import { CompensationAnalysis } from "./CompensationAnalysis";
import { DocumentsList } from "./DocumentsList";
import { HireabilityHeader } from "./HireabilityHeader";
import { InterviewNotes } from "./InterviewNotes";
import { InterviewRecordings } from "./InterviewRecordings";
import { LocationAnalysis } from "./LocationAnalysis";
import { RoleBullets } from "./RoleBullets";
import { RoleChatProvider } from "./RoleChatProvider";
import { RoleConfig } from "./RoleConfig";
import { RolePodcast } from "./RolePodcast";

export function RoleViewport({ role }: { role: RoleRow & { roleInstructions?: string | null } }) {
  const [tab, setTab] = useQueryParam("tab", "overview");

  return (
    <RoleChatProvider roleId={role.id}>
      <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
        <ResizablePanel defaultSize={65} minSize={40}>
          <div className="h-full overflow-auto pr-4">
            <Tabs value={tab} onValueChange={setTab} className="min-w-0">
              <TabsList className="w-full justify-start overflow-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="podcast">Podcast</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="recordings">Recordings</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="config">Config</TabsTrigger>
                <TabsTrigger value="emails">Emails</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <HireabilityHeader roleId={role.id} />
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <LocationAnalysis roleId={role.id} />
                  <CompensationAnalysis roleId={role.id} />
                  <CombinedValueScore roleId={role.id} />
                </div>
                <div className="mt-4">
                  <RoleBullets roleId={role.id} />
                </div>
                <div className="mt-4">
                  <Overview role={role} />
                </div>
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsList roleId={role.id} />
              </TabsContent>
              <TabsContent value="podcast">
                <RolePodcast roleId={role.id} />
              </TabsContent>
              <TabsContent value="notes">
                <InterviewNotes roleId={role.id} />
              </TabsContent>
              <TabsContent value="recordings">
                <InterviewRecordings roleId={role.id} />
              </TabsContent>
              <TabsContent value="analysis">
                <AlignmentBreakdown roleId={role.id} />
              </TabsContent>
              <TabsContent value="config">
                <RoleConfig role={role} />
              </TabsContent>
              <TabsContent value="emails">
                <RoleEmails roleId={role.id} />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="h-full border-l border-border bg-background">
            <Thread />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </RoleChatProvider>
  );
}

function Overview({ role }: { role: RoleRow & { roleInstructions?: string | null } }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
          <CardDescription>Saved metadata for this opportunity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Detail label="Company" value={role.companyName} />
          <Detail label="Title" value={role.jobTitle} />
          <Detail label="Status" value={role.status} />
          <Detail label="Created" value={new Date(role.createdAt).toLocaleString()} />
        </CardContent>
      </Card>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
          <CardDescription>Role-specific Colby guidance.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {role.roleInstructions || "No role-specific instructions have been saved."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RoleEmails({ roleId }: { roleId: string }) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<EmailRow[]>(`/api/emails?roleId=${encodeURIComponent(roleId)}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [roleId]);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Emails</CardTitle>
        <CardDescription>Inbound messages associated with this role.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 rounded-md bg-muted/50" />
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No emails have been associated with this role.
          </p>
        ) : (
          <div className="grid gap-2">
            {rows.map((email) => (
              <div key={email.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{email.subject}</span>
                  <Badge variant="secondary">{email.processedStatus}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">{email.sender}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
