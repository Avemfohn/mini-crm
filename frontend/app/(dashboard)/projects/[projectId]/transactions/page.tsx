"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TableScroll } from "@/components/layout/table-scroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/lib/api/errors";
import {
  ownersApi,
  paymentPlansApi,
  transactionsApi,
  unitsApi,
} from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canWriteProject } from "@/lib/auth/permissions";
import { formatDateDisplay } from "@/lib/format/date";
import { invalidateProjectLedger } from "@/lib/query/invalidate-ledger";
import { statusLabels, tr } from "@/lib/i18n/tr";
import type { Transaction } from "@/lib/api/types";

function formatMoney(amount: string, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export default function TransactionsPage() {
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
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [hideReversals, setHideReversals] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});

  const listParams = useMemo(() => {
    const p: Record<string, string> = { direction: "INFLOW" };
    if (status) p.status = status;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [status, dateFrom, dateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["ledger-inflow", projectId, status, dateFrom, dateTo],
    queryFn: () => api.list(listParams),
  });

  const { data: units } = useQuery({
    queryKey: ["units", projectId],
    queryFn: () => unitsApi(projectId).list(),
  });
  const { data: owners } = useQuery({
    queryKey: ["owners", projectId],
    queryFn: () => ownersApi(projectId).list(),
  });
  const { data: ownersForUnit } = useQuery({
    queryKey: ["owners-at", projectId, form.unit],
    queryFn: () => unitsApi(projectId).ownersAt(form.unit!),
    enabled: Boolean(form.unit),
  });

  const linkedOwner = ownersForUnit?.[0]?.owner;

  useEffect(() => {
    if (!form.unit) return;
    if (linkedOwner?.id) {
      setForm((f) =>
        f.owner === linkedOwner.id ? f : { ...f, owner: linkedOwner.id }
      );
    }
  }, [form.unit, linkedOwner?.id]);

  const { data: planHint } = useQuery({
    queryKey: ["payment-plans", projectId, form.unit, form.owner],
    queryFn: () =>
      paymentPlansApi(projectId).list({
        unit: form.unit,
        owner: form.owner,
      }),
    enabled: Boolean(form.unit && form.owner),
  });

  const currency =
    me?.memberships.find((m) => m.project.id === projectId)?.project.currency ??
    "TRY";

  const invalidate = () => invalidateProjectLedger(qc, projectId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        ...form,
        unit: form.unit || null,
        owner: form.owner || null,
        direction: form.direction || "INFLOW",
      };
      if (editing) payload.category = editing.category;
      if (editing) return api.update(editing.id, payload);
      return api.create(payload);
    },
    onSuccess: () => {
      toast.success(tr.success);
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

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

  const unitMap = new Map(units?.results.map((u) => [u.id, u.unit_number]) ?? []);
  const ownerMap = new Map(owners?.results.map((o) => [o.id, o.full_name]) ?? []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      direction: "INFLOW",
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const openEdit = (row: Transaction) => {
    setEditing(row);
    setForm({
      unit: row.unit ?? "",
      owner: row.owner ?? "",
      transaction_date: row.transaction_date,
      amount: row.amount,
      direction: row.direction,
      description: row.description,
      reference_no: row.reference_no,
    });
    setOpen(true);
  };

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
        row.direction === "INFLOW" &&
        (!hideReversals || row.entry_type === "STANDARD")
    ) ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{tr.transactions}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <select
            className="form-select w-full px-2 sm:w-auto"
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
            className="h-9 w-full sm:w-auto"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title={tr.dateFrom}
          />
          <Input
            type="date"
            className="h-9 w-full sm:w-auto"
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
            {tr.onlyStandardPayments}
          </label>
          {canWrite && (
            <Button className="w-full sm:w-auto lg:ml-auto" onClick={openCreate}>
              {tr.create}
            </Button>
          )}
        </div>
      </div>

      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr.transactionDate}</TableHead>
              <TableHead>{tr.owner}</TableHead>
              <TableHead>{tr.unit}</TableHead>
              <TableHead>{tr.amount}</TableHead>
              <TableHead>{tr.status}</TableHead>
              <TableHead>{tr.description}</TableHead>
              <TableHead>{tr.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7}>{tr.loading}</TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDateDisplay(row.transaction_date)}</TableCell>
                <TableCell>
                  {row.owner ? ownerMap.get(row.owner) ?? "—" : "—"}
                </TableCell>
                <TableCell>
                  {row.unit ? unitMap.get(row.unit) ?? "—" : "—"}
                </TableCell>
                <TableCell>{formatMoney(row.amount, currency)}</TableCell>
                <TableCell>{statusBadge(row)}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {canWrite && row.status === "DRAFT" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        {tr.edit}
                      </Button>
                      <Button size="sm" onClick={() => postMutation.mutate(row.id)}>
                        {tr.post}
                      </Button>
                    </>
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
      </TableScroll>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? tr.edit : tr.create}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr.unit}</Label>
              <select
                className="form-select w-full"
                value={form.unit ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value, owner: "" }))
                }
              >
                <option value="">—</option>
                {units?.results.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                  </option>
                ))}
              </select>
            </div>
            {form.unit && linkedOwner ? (
              <div>
                <Label>{tr.owner}</Label>
                <p className="mt-1 text-sm font-medium">{linkedOwner.full_name}</p>
                <p className="text-xs text-muted-foreground">{tr.ownerAutoFromUnit}</p>
              </div>
            ) : form.unit ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {tr.assignOwnerToPay}
              </p>
            ) : null}
            {planHint?.results[0] && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{tr.planSummary}</p>
                <p>
                  {tr.monthlyPayment}:{" "}
                  {formatMoney(planHint.results[0].monthly_amount, currency)} ×{" "}
                  {planHint.results[0].installment_count}
                </p>
              </div>
            )}
            <div>
              <Label>{tr.transactionDate}</Label>
              <Input
                type="date"
                value={form.transaction_date ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, transaction_date: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.amount}</Label>
              <Input
                value={form.amount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr.paymentNotes}</Label>
              <Textarea
                className="min-h-[100px]"
                placeholder={tr.paymentNotes}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tr.cancel}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={Boolean(form.unit && !linkedOwner)}
            >
              {tr.save}
            </Button>
          </DialogFooter>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidId(null)}>
              {tr.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidId && voidMutation.mutate(voidId)}
            >
              {tr.void}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
