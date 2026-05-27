"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RecordSpendingForm,
  useOutflowCategories,
} from "@/components/payments/record-spending-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/lib/api/errors";
import { categoriesApi, transactionsApi } from "@/lib/api/resources";
import type { Transaction } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { canWriteProject } from "@/lib/auth/permissions";
import { formatDateDisplay } from "@/lib/format/date";
import { invalidateProjectLedger } from "@/lib/query/invalidate-ledger";
import { statusLabels, tr } from "@/lib/i18n/tr";

function formatMoney(amount: string, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export default function SpendingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getRole, me } = useAuth();
  const role = getRole(projectId);
  const canWrite = canWriteProject(role);
  const api = transactionsApi(projectId);
  const qc = useQueryClient();

  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [hideReversals, setHideReversals] = useState(true);

  const listParams = useMemo(() => {
    const p: Record<string, string> = { direction: "OUTFLOW" };
    if (status) p.status = status;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [status, dateFrom, dateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["ledger-outflow", projectId, status, dateFrom, dateTo],
    queryFn: () => api.list(listParams),
  });

  const { data: outflowCategories } = useOutflowCategories(projectId);

  const { data: allCategories } = useQuery({
    queryKey: ["categories", projectId],
    queryFn: () => categoriesApi(projectId).list(),
  });

  const categoryMap = new Map(
    allCategories?.results.map((c) => [c.id, c.name]) ?? []
  );

  const currency =
    me?.memberships.find((m) => m.project.id === projectId)?.project.currency ??
    "TRY";

  const invalidate = () => invalidateProjectLedger(qc, projectId);

  const postMutation = useMutation({
    mutationFn: (id: string) => api.post(id),
    onSuccess: () => {
      toast.success(tr.success);
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      api.void(id, { void_reason: voidReason, create_reversal: false }),
    onSuccess: () => {
      toast.success(tr.success);
      setVoidId(null);
      setVoidReason("");
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const statusBadge = (row: Transaction) => {
    if (row.entry_type === "REVERSAL" && row.status === "ACTIVE") {
      return <Badge variant="secondary">{tr.reversalEntry}</Badge>;
    }
    const variant =
      row.status === "ACTIVE"
        ? "default"
        : row.status === "VOIDED"
          ? "destructive"
          : "secondary";
    return <Badge variant={variant}>{statusLabels[row.status] ?? row.status}</Badge>;
  };

  const visibleRows =
    data?.results.filter(
      (row) =>
        row.direction === "OUTFLOW" &&
        !row.unit &&
        !row.owner &&
        (!hideReversals || row.entry_type === "STANDARD")
    ) ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{tr.spendings}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="form-select w-auto px-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{tr.filters}</option>
            <option value="DRAFT">{tr.draft}</option>
            <option value="ACTIVE">{tr.posted}</option>
            <option value="VOIDED">{tr.voided}</option>
          </select>
          <Input
            type="date"
            className="h-9 w-auto"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title={tr.dateFrom}
          />
          <Input
            type="date"
            className="h-9 w-auto"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title={tr.dateTo}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={hideReversals}
              onChange={(e) => setHideReversals(e.target.checked)}
            />
            {tr.onlyStandardSpendings}
          </label>
          {canWrite && (
            <Button onClick={() => setOpen(true)} disabled={!outflowCategories?.length}>
              {tr.recordSpending}
            </Button>
          )}
        </div>
      </div>

      <div className="lux-table rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr.transactionDate}</TableHead>
              <TableHead>{tr.category}</TableHead>
              <TableHead>{tr.amount}</TableHead>
              <TableHead>{tr.status}</TableHead>
              <TableHead>{tr.notes}</TableHead>
              <TableHead>{tr.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6}>{tr.loading}</TableCell>
              </TableRow>
            )}
            {!isLoading && visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {tr.empty}
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDateDisplay(row.transaction_date)}</TableCell>
                <TableCell>{categoryMap.get(row.category) ?? "—"}</TableCell>
                <TableCell>{formatMoney(row.amount, currency)}</TableCell>
                <TableCell>{statusBadge(row)}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className="space-x-2">
                  {canWrite && row.status === "DRAFT" && (
                    <Button size="sm" onClick={() => postMutation.mutate(row.id)}>
                      {tr.post}
                    </Button>
                  )}
                  {canWrite && row.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setVoidId(row.id)}
                    >
                      {tr.void}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr.recordSpending}</DialogTitle>
          </DialogHeader>
          {outflowCategories && outflowCategories.length > 0 ? (
            <RecordSpendingForm
              projectId={projectId}
              categories={outflowCategories}
              onSuccess={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{tr.empty}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!voidId} onOpenChange={() => setVoidId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr.void}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{tr.voidReason}</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidId(null)}>
              {tr.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidId && voidMutation.mutate(voidId)}
            >
              {tr.void}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
