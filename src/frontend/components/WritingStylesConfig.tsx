import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ── Types ────────────────────────────────────────────────────────────────────

type ConditionField = "from_address" | "from_domain" | "to_address" | "subject" | "body" | "cc";
type ConditionOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "not_contains"
  | "matches_regex";

interface StyleCondition {
  id: string;
  style_id: string;
  condition_field: ConditionField;
  condition_operator: ConditionOperator;
  condition_value: string;
  created_at: string;
}

interface WritingStyle {
  id: string;
  name: string;
  description: string | null;
  style_prompt: string;
  priority: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  conditions: StyleCondition[];
}

interface GmailMessage {
  id: string;
  thread_id: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<ConditionField, string> = {
  from_address: "From (address)",
  from_domain: "From (domain)",
  to_address: "To (address)",
  subject: "Subject",
  body: "Body",
  cc: "CC",
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  contains: "contains",
  equals: "equals",
  starts_with: "starts with",
  ends_with: "ends with",
  not_contains: "does not contain",
  matches_regex: "matches regex",
};

// ── Condition Builder ─────────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: StyleCondition;
  onDelete: (id: string) => void;
}

function ConditionRow({ condition, onDelete }: ConditionRowProps) {
  return (
    <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
      <span className="font-medium text-muted-foreground">IF</span>
      <Badge variant="outline">{FIELD_LABELS[condition.condition_field]}</Badge>
      <span className="text-muted-foreground">{OPERATOR_LABELS[condition.condition_operator]}</span>
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        {condition.condition_value}
      </code>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-6 px-2 text-xs text-destructive"
        onClick={() => onDelete(condition.id)}
      >
        Remove
      </Button>
    </div>
  );
}

// ── Gmail Preview ─────────────────────────────────────────────────────────────

interface GmailPreviewProps {
  conditions: Omit<StyleCondition, "id" | "style_id" | "created_at">[];
}

function GmailPreview({ conditions }: GmailPreviewProps) {
  const [messages, setMessages] = React.useState<GmailMessage[]>([]);
  const [query, setQuery] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const search = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/gmail/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions, max_results: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        setQuery(data.query ?? "");
      }
    } catch (err) {
      console.error("Gmail search error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Preview which emails in your inbox match these conditions.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={search}
          disabled={loading || conditions.length === 0}
        >
          {loading ? "Searching…" : "Preview in Gmail"}
        </Button>
      </div>

      {query && (
        <p className="font-mono text-xs text-muted-foreground">
          Query: <span className="text-foreground">{query}</span>
        </p>
      )}

      {searched && messages.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic">No matching emails found.</p>
      )}

      <div className="space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="rounded border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{msg.subject}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(msg.date).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{msg.sender}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{msg.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Style Dialog (Create / Edit) ──────────────────────────────────────────────

interface StyleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStyle?: WritingStyle | null;
  onSaved: (style: WritingStyle) => void;
}

function StyleDialog({ open, onOpenChange, initialStyle, onSaved }: StyleDialogProps) {
  const [name, setName] = React.useState(initialStyle?.name ?? "");
  const [description, setDescription] = React.useState(initialStyle?.description ?? "");
  const [stylePrompt, setStylePrompt] = React.useState(initialStyle?.style_prompt ?? "");
  const [priority, setPriority] = React.useState(String(initialStyle?.priority ?? 0));
  const [isEnabled, setIsEnabled] = React.useState(initialStyle?.is_enabled ?? true);
  const [conditions, setConditions] = React.useState<StyleCondition[]>(
    initialStyle?.conditions ?? [],
  );

  // New condition form state
  const [newField, setNewField] = React.useState<ConditionField>("from_domain");
  const [newOperator, setNewOperator] = React.useState<ConditionOperator>("equals");
  const [newValue, setNewValue] = React.useState("");

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialStyle?.name ?? "");
      setDescription(initialStyle?.description ?? "");
      setStylePrompt(initialStyle?.style_prompt ?? "");
      setPriority(String(initialStyle?.priority ?? 0));
      setIsEnabled(initialStyle?.is_enabled ?? true);
      setConditions(initialStyle?.conditions ?? []);
      setNewField("from_domain");
      setNewOperator("equals");
      setNewValue("");
    }
  }, [open, initialStyle]);

  const addCondition = async () => {
    if (!newValue.trim()) return;

    // If editing an existing style, persist immediately
    if (initialStyle) {
      try {
        const res = await fetch(`/api/writing-styles/${initialStyle.id}/conditions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            condition_field: newField,
            condition_operator: newOperator,
            condition_value: newValue.trim(),
          }),
        });
        if (res.ok) {
          const created: StyleCondition = await res.json();
          setConditions((prev) => [...prev, created]);
          setNewValue("");
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Otherwise add to local state (new style, not yet saved)
    setConditions((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        style_id: "",
        condition_field: newField,
        condition_operator: newOperator,
        condition_value: newValue.trim(),
        created_at: new Date().toISOString(),
      },
    ]);
    setNewValue("");
  };

  const removeCondition = async (condId: string) => {
    if (initialStyle && !condId.startsWith("local-")) {
      try {
        await fetch(`/api/writing-styles/${initialStyle.id}/conditions/${condId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error(err);
      }
    }
    setConditions((prev) => prev.filter((c) => c.id !== condId));
  };

  const save = async () => {
    if (!name.trim() || !stylePrompt.trim()) return;
    setSaving(true);

    try {
      if (initialStyle) {
        // Update existing
        await fetch(`/api/writing-styles/${initialStyle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || null,
            style_prompt: stylePrompt,
            priority: Number(priority),
            is_enabled: isEnabled,
          }),
        });
        onSaved({
          ...initialStyle,
          name,
          description: description || null,
          style_prompt: stylePrompt,
          priority: Number(priority),
          is_enabled: isEnabled,
          conditions,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new
        const res = await fetch("/api/writing-styles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || null,
            style_prompt: stylePrompt,
            priority: Number(priority),
            is_enabled: isEnabled,
          }),
        });
        if (!res.ok) throw new Error("Failed to create style");
        const created: WritingStyle = await res.json();

        // Add local conditions to the new style
        const localConditions = conditions.filter((c) => c.id.startsWith("local-"));
        const savedConditions: StyleCondition[] = [];
        for (const lc of localConditions) {
          try {
            const cRes = await fetch(`/api/writing-styles/${created.id}/conditions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                condition_field: lc.condition_field,
                condition_operator: lc.condition_operator,
                condition_value: lc.condition_value,
              }),
            });
            if (cRes.ok) savedConditions.push(await cRes.json());
          } catch (err) {
            console.error(err);
          }
        }
        onSaved({ ...created, conditions: savedConditions });
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const previewConditions = conditions.map((c) => ({
    condition_field: c.condition_field,
    condition_operator: c.condition_operator,
    condition_value: c.condition_value,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialStyle ? "Edit Writing Style" : "New Writing Style"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Basic fields ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="style-name">Name</Label>
              <Input
                id="style-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Formal replies for legal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="style-priority">Priority (higher = preferred)</Label>
              <Input
                id="style-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="style-description">Description (optional)</Label>
            <Input
              id="style-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of when this style applies"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="style-prompt">Writing Style Prompt</Label>
            <Textarea
              id="style-prompt"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              rows={5}
              placeholder="Describe the writing style the AI should use for draft replies that match these conditions…"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="style-enabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="style-enabled">Enabled</Label>
          </div>

          {/* ── Conditions ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Conditions{" "}
              <span className="font-normal text-muted-foreground">
                (all must match — AND logic)
              </span>
            </h3>

            {conditions.map((cond) => (
              <ConditionRow key={cond.id} condition={cond} onDelete={removeCondition} />
            ))}

            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No conditions — this style applies to all emails (universal default).
              </p>
            )}

            {/* Add condition row */}
            <div className="flex flex-wrap items-end gap-2 rounded border border-dashed px-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Field</Label>
                <Select value={newField} onValueChange={(v) => setNewField(v as ConditionField)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_LABELS) as ConditionField[]).map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {FIELD_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Select
                  value={newOperator}
                  onValueChange={(v) => setNewOperator(v as ConditionOperator)}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                      <SelectItem key={op} value={op} className="text-xs">
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  className="h-8 text-xs"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCondition()}
                  placeholder="e.g. @acme.com"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={addCondition}
                disabled={!newValue.trim()}
              >
                + Add
              </Button>
            </div>
          </div>

          {/* ── Gmail Preview ── */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Live Gmail Preview</h3>
            <GmailPreview conditions={previewConditions} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim() || !stylePrompt.trim()}>
            {saving ? "Saving…" : initialStyle ? "Save Changes" : "Create Style"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main WritingStylesConfig component ────────────────────────────────────────

export function WritingStylesConfig({ initialStyles }: { initialStyles: WritingStyle[] }) {
  const [styles, setStyles] = React.useState<WritingStyle[]>(initialStyles ?? []);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingStyle, setEditingStyle] = React.useState<WritingStyle | null>(null);

  const openCreate = () => {
    setEditingStyle(null);
    setDialogOpen(true);
  };

  const openEdit = (style: WritingStyle) => {
    setEditingStyle(style);
    setDialogOpen(true);
  };

  const handleSaved = (saved: WritingStyle) => {
    setStyles((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
  };

  const deleteStyle = async (id: string) => {
    if (!confirm("Delete this writing style and all its conditions?")) return;
    try {
      const res = await fetch(`/api/writing-styles/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStyles((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleEnabled = async (style: WritingStyle) => {
    try {
      const res = await fetch(`/api/writing-styles/${style.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !style.is_enabled }),
      });
      if (res.ok) {
        setStyles((prev) =>
          prev.map((s) => (s.id === style.id ? { ...s, is_enabled: !s.is_enabled } : s)),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Writing Styles</h2>
          <p className="text-sm text-muted-foreground">
            Configure IFTTT-style rules to select the AI writing style used when drafting replies.
            Styles are evaluated in descending priority order; the first fully-matching style wins.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Style</Button>
      </div>

      {styles.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No writing styles configured yet. Create one to get started.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {styles
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((style) => (
            <Card key={style.id} className={style.is_enabled ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{style.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        priority {style.priority}
                      </Badge>
                      {style.is_enabled ? (
                        <Badge className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    {style.description && (
                      <p className="text-sm text-muted-foreground">{style.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleEnabled(style)}>
                      {style.is_enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(style)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteStyle(style.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Conditions summary */}
                {style.conditions.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Applies when (ALL must match)
                    </p>
                    {style.conditions.map((cond) => (
                      <div
                        key={cond.id}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">IF</span>
                        <Badge variant="outline" className="text-xs">
                          {FIELD_LABELS[cond.condition_field]}
                        </Badge>
                        <span>{OPERATOR_LABELS[cond.condition_operator]}</span>
                        <code className="rounded bg-muted px-1 font-mono">
                          {cond.condition_value}
                        </code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Universal default — no conditions (applies to all non-spam emails)
                  </p>
                )}

                {/* Style prompt preview */}
                <div className="rounded bg-muted/50 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Style prompt</p>
                  <p className="text-xs line-clamp-3 whitespace-pre-wrap">{style.style_prompt}</p>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <StyleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStyle={editingStyle}
        onSaved={handleSaved}
      />
    </div>
  );
}
