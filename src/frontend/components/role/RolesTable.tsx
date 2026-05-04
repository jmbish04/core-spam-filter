import { ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api-client";

import type { RoleRow } from "../dashboard/types";

const statuses = [
  "all",
  "preparing",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived",
];
type SortKey = "companyName" | "jobTitle" | "status" | "createdAt";

export function RolesTable() {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<RoleRow[]>("/api/roles")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const visibleRows = useMemo(() => {
    const normalized = query.toLowerCase();

    return rows
      .filter((role) => status === "all" || role.status === status)
      .filter(
        (role) =>
          role.companyName.toLowerCase().includes(normalized) ||
          role.jobTitle.toLowerCase().includes(normalized),
      )
      .sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
  }, [query, rows, sort, status]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by company or title"
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {statuses.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={status === item ? "secondary" : "outline"}
              onClick={() => setStatus(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Company" sortKey="companyName" sort={sort} onSort={setSort} />
              <SortableHead label="Title" sortKey="jobTitle" sort={sort} onSort={setSort} />
              <SortableHead label="Status" sortKey="status" sort={sort} onSort={setSort} />
              <TableHead>Salary</TableHead>
              <SortableHead label="Created" sortKey="createdAt" sort={sort} onSort={setSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading roles...
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No roles match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <a className="font-medium hover:underline" href={`/roles/${role.id}`}>
                      {role.companyName}
                    </a>
                  </TableCell>
                  <TableCell>{role.jobTitle}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.status}</Badge>
                  </TableCell>
                  <TableCell>{formatSalary(role)}</TableCell>
                  <TableCell>{new Date(role.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}) {
  return (
    <TableHead>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-ml-2"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={sort === sortKey ? "size-3.5 text-foreground" : "size-3.5"} />
      </Button>
    </TableHead>
  );
}

function formatSalary(role: RoleRow) {
  if (role.salaryMin === null && role.salaryMax === null) {
    return "Not set";
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
