"use client";

import {
  ChevronDownIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, toast } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleBulletRow {
  id: number;
  roleId: string;
  type: string;
  content: string;
  sortOrder: number;
  aiScore: number | null;
  aiRationale: string | null;
  revisionNumber: number | null;
}

interface RoleBulletsProps {
  roleId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  KEY_RESPONSIBILITY: "Key Responsibilities",
  REQUIRED_QUALIFICATION: "Required Qualifications",
  PREFERRED_QUALIFICATION: "Preferred Qualifications",
  REQUIRED_SKILL: "Required Skills",
  PREFERRED_SKILL: "Preferred Skills",
  EDUCATION_REQUIREMENT: "Education Requirements",
  BENEFIT: "Benefits",
};

const TYPE_ORDER = [
  "KEY_RESPONSIBILITY",
  "REQUIRED_QUALIFICATION",
  "PREFERRED_QUALIFICATION",
  "REQUIRED_SKILL",
  "PREFERRED_SKILL",
  "EDUCATION_REQUIREMENT",
  "BENEFIT",
];

function getScoreTier(score: number | null) {
  if (score === null || score === undefined) {
    return { color: "bg-muted/50 text-muted-foreground border-border", label: "—" };
  }
  if (score >= 75) {
    return {
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      label: score.toString(),
    };
  }
  if (score >= 40) {
    return {
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      label: score.toString(),
    };
  }
  return {
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    label: score.toString(),
  };
}

// ---------------------------------------------------------------------------
// BulletItem — single bullet with score badge + expandable rationale
// ---------------------------------------------------------------------------

function BulletItem({
  bullet,
  roleId,
  onDelete,
  onUpdate,
}: {
  bullet: RoleBulletRow;
  roleId: string;
  onDelete: (id: number) => void;
  onUpdate: (id: number, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(bullet.content);
  const tier = getScoreTier(bullet.aiScore);

  async function handleSave() {
    if (!editValue.trim()) return;
    try {
      await fetch(`/api/roles/${roleId}/bullets/${bullet.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: editValue.trim() }),
      });
      onUpdate(bullet.id, editValue.trim());
      setEditing(false);
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/roles/${roleId}/bullets/${bullet.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      onDelete(bullet.id);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  if (editing) {
    return (
      <div className="flex items-start gap-2 py-1.5 px-3">
        <Badge
          variant="outline"
          className={`${tier.color} font-mono text-xs min-w-[44px] justify-center mt-1.5`}
        >
          {tier.label}
        </Badge>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 resize-none text-sm min-h-[2.25rem]"
          rows={Math.max(2, Math.ceil(editValue.length / 80))}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSave();
            }
            if (e.key === "Escape") {
              setEditValue(bullet.content);
              setEditing(false);
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-emerald-400"
          onClick={() => void handleSave()}
        >
          <CheckIcon className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={() => {
            setEditValue(bullet.content);
            setEditing(false);
          }}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center gap-1">
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors text-left">
          <Badge
            variant="outline"
            className={`${tier.color} font-mono text-xs min-w-[44px] justify-center`}
          >
            {tier.label}
          </Badge>
          <span className="flex-1 text-sm">{bullet.content}</span>
          {bullet.aiRationale && (
            <ChevronDownIcon
              className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </CollapsibleTrigger>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <PencilIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => void handleDelete()}
          >
            <TrashIcon className="size-3" />
          </Button>
        </div>
      </div>
      {bullet.aiRationale && (
        <CollapsibleContent>
          <div className="pl-14 pr-3 pb-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{bullet.aiRationale}</p>
            {bullet.revisionNumber && bullet.revisionNumber > 1 && (
              <span className="mt-1 inline-block text-xs text-muted-foreground/60">
                Revision #{bullet.revisionNumber}
              </span>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// BulletTypeSection — group header + items for a single type
// ---------------------------------------------------------------------------

function BulletTypeSection({
  type,
  bullets,
  roleId,
  onDelete,
  onUpdate,
  onAdd,
}: {
  type: string;
  bullets: RoleBulletRow[];
  roleId: string;
  onDelete: (id: number) => void;
  onUpdate: (id: number, content: string) => void;
  onAdd: (type: string, content: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");

  // Compute summary stats
  const scored = bullets.filter((b) => b.aiScore !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, b) => sum + (b.aiScore ?? 0), 0) / scored.length)
      : null;

  const avgTier = getScoreTier(avgScore);

  async function handleAdd() {
    if (!newContent.trim()) return;
    onAdd(type, newContent.trim());
    setNewContent("");
    setAdding(false);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {TYPE_LABELS[type] ?? type}
        </span>
        <Badge variant="secondary" className="text-xs">
          {bullets.length}
        </Badge>
        {avgScore !== null && (
          <Badge variant="outline" className={`${avgTier.color} text-xs ml-1`}>
            avg {avgScore}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() => setAdding(true)}
        >
          <PlusIcon className="size-3 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-0.5">
        {bullets.map((bullet) => (
          <BulletItem
            key={bullet.id}
            bullet={bullet}
            roleId={roleId}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {adding && (
        <div className="flex items-start gap-2 px-3 py-1.5">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Enter bullet content…"
            className="flex-1 resize-none text-sm min-h-[2.25rem]"
            rows={Math.max(2, Math.ceil(newContent.length / 80))}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleAdd();
              }
              if (e.key === "Escape") {
                setNewContent("");
                setAdding(false);
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => void handleAdd()}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              setNewContent("");
              setAdding(false);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoleBullets — exported component
// ---------------------------------------------------------------------------

export function RoleBullets({ roleId }: RoleBulletsProps) {
  const [bullets, setBullets] = useState<RoleBulletRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(`/api/roles/${roleId}/bullets`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { bullets: RoleBulletRow[] };
        setBullets(data.bullets ?? []);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [roleId]);

  function handleDelete(id: number) {
    setBullets((prev) => prev.filter((b) => b.id !== id));
  }

  function handleUpdate(id: number, content: string) {
    setBullets((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  }

  async function handleAdd(type: string, content: string) {
    try {
      const res = await fetch(`/api/roles/${roleId}/bullets/single`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, content }),
      });
      if (res.ok) {
        const created = (await res.json()) as RoleBulletRow;
        setBullets((prev) => [
          ...prev,
          { ...created, aiScore: null, aiRationale: null, revisionNumber: null },
        ]);
      }
    } catch {
      toast({ title: "Failed to add bullet", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (bullets.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">
            No role bullets found. Add bullets via the intake form or manually below.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by type in defined order
  const grouped = new Map<string, RoleBulletRow[]>();
  for (const type of TYPE_ORDER) {
    const items = bullets.filter((b) => b.type === type);
    if (items.length > 0) {
      grouped.set(type, items);
    }
  }
  // Include any types not in TYPE_ORDER
  for (const bullet of bullets) {
    if (!TYPE_ORDER.includes(bullet.type)) {
      const existing = grouped.get(bullet.type) ?? [];
      existing.push(bullet);
      grouped.set(bullet.type, existing);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role Bullets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from(grouped.entries()).map(([type, items]) => (
          <BulletTypeSection
            key={type}
            type={type}
            bullets={items}
            roleId={roleId}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onAdd={handleAdd}
          />
        ))}
      </CardContent>
    </Card>
  );
}
