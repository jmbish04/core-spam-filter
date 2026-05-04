import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function HighAlertFeed({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-4 border rounded-lg text-center text-muted-foreground">
        No high alerts found.
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">High Alert Feed</h2>
      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {alerts.map((alert: any) => (
            <Dialog key={alert.id}>
              <DialogTrigger
                render={
                  <div className="p-4 border rounded cursor-pointer hover:bg-muted/50 transition-colors" />
                }
              >
                <div className="flex justify-between items-start mb-2 pointer-events-none">
                  <span className="font-medium truncate mr-4">
                    {alert.subject || "(No Subject)"}
                  </span>
                  <Badge variant="destructive">High Alert</Badge>
                </div>
                <div className="text-sm text-muted-foreground truncate pointer-events-none">
                  {alert.sender}
                </div>
                <div className="text-sm mt-2 line-clamp-2 pointer-events-none">
                  {alert.body_snippet}
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{alert.subject}</DialogTitle>
                  <DialogDescription>
                    From: {alert.sender} <br />
                    To: {alert.recipient}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Rationale</h4>
                    <p className="text-sm text-muted-foreground">{alert.rationale}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Snippet</h4>
                    <div className="bg-muted p-4 rounded text-sm whitespace-pre-wrap">
                      {alert.body_snippet}
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <a
                      href={`https://mail.google.com/mail/u/0/#all/${alert.message_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open in Gmail ↗
                    </a>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
