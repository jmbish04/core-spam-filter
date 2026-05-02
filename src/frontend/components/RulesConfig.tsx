import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RulesConfig({ initialRules }: { initialRules: any[] }) {
  const [rules, setRules] = React.useState(initialRules || []);
  const [ruleType, setRuleType] = React.useState("keyword");
  const [classification, setClassification] = React.useState("spam");
  const [value, setValue] = React.useState("");

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;

    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_type: ruleType, classification, value }),
      });
      if (res.ok) {
        const newRule = await res.json();
        setRules([...rules, newRule]);
        setValue("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules(rules.filter((r: any) => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Add Rule</h2>
        <form onSubmit={addRule} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="rule-type" className="text-sm font-medium">
              Rule Type
            </Label>
            <Select value={ruleType} onValueChange={(val) => setRuleType(val || "keyword")}>
              <SelectTrigger id="rule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Keyword</SelectItem>
                <SelectItem value="domain">Domain</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="classification-type" className="text-sm font-medium">
              Classification
            </Label>
            <Select
              value={classification}
              onValueChange={(val) => setClassification(val || "spam")}
            >
              <SelectTrigger id="classification-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="safe">Safe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] space-y-2">
            <Label htmlFor="rule-value" className="text-sm font-medium">
              Value
            </Label>
            <Input
              id="rule-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. example.com"
            />
          </div>
          <Button type="submit">Add Rule</Button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Existing Rules</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell className="capitalize">{rule.rule_type}</TableCell>
                <TableCell>{rule.value}</TableCell>
                <TableCell>
                  <Badge variant={rule.classification === "spam" ? "destructive" : "default"}>
                    {rule.classification}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
