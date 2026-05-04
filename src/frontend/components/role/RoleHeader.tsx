import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  LogOut,
  Mic,
  Send,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiPatch } from "@/lib/api-client";

import type { RoleRow } from "../dashboard/types";

// ---------------------------------------------------------------------------
// Status metadata — icon, color, label, and workflow group
// ---------------------------------------------------------------------------

type StatusMeta = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeClass: string;
  group: "active" | "terminal";
};

const STATUS_META: Record<string, StatusMeta> = {
  preparing: {
    label: "Preparing",
    icon: Clock,
    color: "text-blue-400",
    badgeClass: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    group: "active",
  },
  applied: {
    label: "Applied",
    icon: Send,
    color: "text-cyan-400",
    badgeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    group: "active",
  },
  interviewing: {
    label: "Interviewing",
    icon: Mic,
    color: "text-amber-400",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    group: "active",
  },
  offer: {
    label: "Offer",
    icon: CheckCircle2,
    color: "text-emerald-400",
    badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    group: "active",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-400",
    badgeClass: "border-red-500/40 bg-red-500/10 text-red-400",
    group: "terminal",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: LogOut,
    color: "text-slate-400",
    badgeClass: "border-slate-500/40 bg-slate-500/10 text-slate-400",
    group: "terminal",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    color: "text-zinc-500",
    badgeClass: "border-zinc-500/40 bg-zinc-500/10 text-zinc-500",
    group: "terminal",
  },
};

const ACTIVE_STATUSES = Object.entries(STATUS_META).filter(([, m]) => m.group === "active");
const TERMINAL_STATUSES = Object.entries(STATUS_META).filter(([, m]) => m.group === "terminal");

// Workflow progression order for the timeline
const WORKFLOW_ORDER = ["preparing", "applied", "interviewing", "offer"];

export function RoleHeader({ role }: { role: RoleRow }) {
  const [current, setCurrent] = useState(role);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateStatus(status: string) {
    if (status === current.status || isUpdating) {
      return;
    }

    setIsUpdating(true);
    try {
      const next = await apiPatch<RoleRow>(`/api/roles/${current.id}`, { status });
      setCurrent(next);
    } finally {
      setIsUpdating(false);
    }
  }

  const meta = STATUS_META[current.status] ?? STATUS_META.preparing!;
  const StatusIcon = meta.icon;
  const currentIdx = WORKFLOW_ORDER.indexOf(current.status);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{current.companyName}</h1>
          <Badge className={`gap-1.5 ${meta.badgeClass}`} variant="outline">
            <StatusIcon className="size-3.5" />
            {meta.label}
          </Badge>
        </div>
        <p className="mt-1 text-lg text-muted-foreground">{current.jobTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{formatSalary(current)}</p>

        {/* Job posting links */}
        {(current.jobUrl || current.jobPostingPdfUrl) && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {current.jobUrl && (
              <a
                href={current.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                <ExternalLink className="size-3.5" />
                View Original Posting
              </a>
            )}
            {current.jobPostingPdfUrl && (
              <a
                href={current.jobPostingPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-400 transition-colors hover:text-emerald-300"
              >
                <FileText className="size-3.5" />
                View PDF Snapshot
              </a>
            )}
          </div>
        )}

        {/* Workflow timeline */}
        <div className="mt-3 flex items-center gap-1">
          {WORKFLOW_ORDER.map((step, idx) => {
            const stepMeta = STATUS_META[step]!;
            const StepIcon = stepMeta.icon;
            const isCompleted = currentIdx >= 0 && idx <= currentIdx;
            const isCurrent = step === current.status;

            return (
              <div key={step} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? `${stepMeta.badgeClass} ring-1 ring-current/20`
                      : isCompleted
                        ? `${stepMeta.color} opacity-60`
                        : "text-muted-foreground/40"
                  }`}
                >
                  <StepIcon className="size-3" />
                  <span className="hidden sm:inline">{stepMeta.label}</span>
                </div>
                {idx < WORKFLOW_ORDER.length - 1 && (
                  <div
                    className={`h-px w-4 sm:w-6 ${
                      currentIdx >= 0 && idx < currentIdx
                        ? "bg-muted-foreground/40"
                        : "bg-border/40"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5" disabled={isUpdating}>
              <StatusIcon className={`size-4 ${meta.color}`} />
              {isUpdating ? "Updating…" : "Change Status"}
              <ChevronDown className="size-3.5 opacity-50" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          {ACTIVE_STATUSES.map(([key, m]) => {
            const Icon = m.icon;
            return (
              <DropdownMenuItem
                key={key}
                className={`gap-2 ${current.status === key ? "bg-accent" : ""}`}
                onClick={() => void updateStatus(key)}
              >
                <Icon className={`size-4 ${m.color}`} />
                {m.label}
                {current.status === key && (
                  <span className="ml-auto text-xs text-muted-foreground">Current</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {TERMINAL_STATUSES.map(([key, m]) => {
            const Icon = m.icon;
            return (
              <DropdownMenuItem
                key={key}
                className={`gap-2 ${current.status === key ? "bg-accent" : ""}`}
                onClick={() => void updateStatus(key)}
              >
                <Icon className={`size-4 ${m.color}`} />
                {m.label}
                {current.status === key && (
                  <span className="ml-auto text-xs text-muted-foreground">Current</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatSalary(role: RoleRow) {
  if (role.salaryMin === null && role.salaryMax === null) {
    return "Salary not set";
  }

  const currency = role.salaryCurrency ?? "USD";
  const formatter = new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  });

  if (role.salaryMin !== null && role.salaryMax !== null) {
    return `${formatter.format(role.salaryMin)} - ${formatter.format(role.salaryMax)}`;
  }

  return formatter.format(role.salaryMin ?? role.salaryMax ?? 0);
}
