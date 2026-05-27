"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/form/money-input";
import { PageHeader } from "@/components/layout/page-header";
import { TableScroll } from "@/components/layout/table-scroll";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatApiError } from "@/lib/api/errors";
import { formatAmountFromApi } from "@/lib/format/amount";
import { formatDateDisplay } from "@/lib/format/date";
import { buildSchedulePreview } from "@/lib/format/schedule-preview";
import { invalidateProjectLedger } from "@/lib/query/invalidate-ledger";
import {
  ownersApi,
  paymentPlansApi,
  projectsApi,
  transactionsApi,
  unitsApi,
} from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canWriteProject } from "@/lib/auth/permissions";
import { statusLabels, tr } from "@/lib/i18n/tr";

function formatMoney(amount: number | string, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export default function UnitDetailPage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId: string }>();
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const canWrite = canWriteProject(role);
  const qc = useQueryClient();
  const api = unitsApi(projectId);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: unit, isLoading } = useQuery({
    queryKey: ["unit", projectId, unitId],
    queryFn: () => api.get(unitId),
  });

  const { data: ownersAt } = useQuery({
    queryKey: ["owners-at", projectId, unitId],
    queryFn: () => api.ownersAt(unitId),
  });

  const { data: owners } = useQuery({
    queryKey: ["owners", projectId],
    queryFn: () => ownersApi(projectId).list(),
  });

  const currentOwner = ownersAt?.[0]?.owner;

  const { data: plans } = useQuery({
    queryKey: ["payment-plans", projectId, unitId, currentOwner?.id],
    queryFn: () =>
      paymentPlansApi(projectId).list({
        unit: unitId,
        owner: currentOwner!.id,
      }),
    enabled: Boolean(currentOwner?.id),
  });

  const {
    data: transactions,
    isLoading: transactionsLoading,
    isError: transactionsError,
    error: transactionsQueryError,
  } = useQuery({
    queryKey: ["transactions", projectId, unitId],
    queryFn: () => transactionsApi(projectId).list({ unit: unitId }),
  });

  const currency = project?.currency ?? "TRY";
  const plan = plans?.results[0];
  const loadedPlanIdRef = useRef<string | null>(null);

  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [totalDisplay, setTotalDisplay] = useState("");
  const [totalApi, setTotalApi] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [planNotes, setPlanNotes] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [planEditUnlocked, setPlanEditUnlocked] = useState(false);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const planLocked = Boolean(plan) && !planEditUnlocked;
  const txnApi = transactionsApi(projectId);

  const visibleTransactions = useMemo(
    () =>
      transactions?.results.filter((t) => t.entry_type === "STANDARD") ?? [],
    [transactions?.results]
  );

  useEffect(() => {
    if (currentOwner) {
      setSelectedOwnerId(currentOwner.id);
    }
  }, [currentOwner]);

  useEffect(() => {
    if (!plan) {
      loadedPlanIdRef.current = null;
      return;
    }
    if (loadedPlanIdRef.current === plan.id) return;
    loadedPlanIdRef.current = plan.id;
    setTotalDisplay(formatAmountFromApi(plan.total_amount));
    setTotalApi(plan.total_amount);
    setInstallmentCount(String(plan.installment_count));
    setStartDate(plan.start_date);
    setPlanNotes(plan.notes ?? "");
    setPlanDirty(false);
    setPlanEditUnlocked(false);
  }, [plan]);

  const resetPlanFromSaved = () => {
    if (!plan) return;
    setTotalDisplay(formatAmountFromApi(plan.total_amount));
    setTotalApi(plan.total_amount);
    setInstallmentCount(String(plan.installment_count));
    setStartDate(plan.start_date);
    setPlanNotes(plan.notes ?? "");
    setPlanDirty(false);
    setPlanEditUnlocked(false);
  };

  const requestPlanEdit = () => {
    if (!plan || planEditUnlocked) return;
    setChangePlanDialogOpen(true);
  };

  const confirmPlanEdit = () => {
    setPlanEditUnlocked(true);
    setChangePlanDialogOpen(false);
  };

  const savePlanMutation = useMutation({
    mutationFn: async (payload: {
      total_amount: string;
      installment_count: number;
      start_date: string;
      notes: string;
      ownerId: string;
      planId?: string;
    }) => {
      const body = {
        unit_id: unitId,
        owner_id: payload.ownerId,
        total_amount: payload.total_amount,
        installment_count: payload.installment_count,
        start_date: payload.start_date,
        notes: payload.notes,
      };
      if (payload.planId) {
        return paymentPlansApi(projectId).update(payload.planId, body);
      }
      return paymentPlansApi(projectId).create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-plans", projectId] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      txnApi.void(id, { void_reason: voidReason, create_reversal: false }),
    onSuccess: async () => {
      toast.success(tr.success);
      setVoidId(null);
      setVoidReason("");
      await invalidateProjectLedger(qc, projectId);
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const setOwnerMutation = useMutation({
    mutationFn: (ownerId: string) => api.setOwner(unitId, { owner_id: ownerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners-at", projectId, unitId] });
      qc.invalidateQueries({ queryKey: ["payment-plans", projectId] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const previewSchedule = useMemo(() => {
    const total = Number(totalApi);
    const count = Number(installmentCount);
    if (!totalApi || count < 1 || !startDate) return [];
    return buildSchedulePreview(total, count, startDate);
  }, [totalApi, installmentCount, startDate]);

  const displaySchedule = useMemo(() => {
    if (planDirty || !plan?.schedule?.length) {
      return previewSchedule;
    }
    return plan.schedule.map((row) => ({
      installment: row.installment,
      due_date: row.due_date,
      expected: Number(row.expected),
      paid: Number(row.paid),
      remaining: Number(row.remaining),
    }));
  }, [plan?.schedule, previewSchedule, planDirty]);

  const handleOwnerChange = (ownerId: string) => {
    setSelectedOwnerId(ownerId);
  };

  const handleSaveCard = async () => {
    try {
      const ownerId = selectedOwnerId;
      if (!ownerId) {
        toast.error(tr.noOwner);
        return;
      }
      if (ownerId !== currentOwner?.id) {
        await setOwnerMutation.mutateAsync(ownerId);
      }
      if (planDirty || !plan) {
        if (!totalApi || Number(installmentCount) < 1) {
          toast.error(tr.error);
          return;
        }
        await savePlanMutation.mutateAsync({
          total_amount: totalApi,
          installment_count: Number(installmentCount),
          start_date: startDate,
          notes: planNotes,
          ownerId,
          planId: plan?.id,
        });
        setPlanDirty(false);
        setPlanEditUnlocked(false);
      }
      toast.success(tr.success);
    } catch {
      /* toast from mutations */
    }
  };

  const markPlanEdited = () => setPlanDirty(true);

  const monthlyPreview =
    totalApi && Number(installmentCount) >= 1
      ? Number(totalApi) / Number(installmentCount)
      : 0;

  if (isLoading) return <p>{tr.loading}</p>;
  if (!unit) return null;

  return (
    <div>
      <PageHeader
        title={`${tr.unitDetail}: ${unit.unit_number}`}
        description={project?.name}
        actions={
          <Link href={`/projects/${projectId}/units`}>
            <Button variant="outline" type="button">
              {tr.back}
            </Button>
          </Link>
        }
      />

      <Card className="lux-card">
        <CardHeader>
          <CardTitle>
            {tr.unit} {unit.unit_number}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">{tr.floor}: </span>
              {unit.floor ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{tr.status}: </span>
              {statusLabels[unit.status] ?? unit.status}
            </p>
            <p>
              <span className="text-muted-foreground">{tr.notes}: </span>
              {unit.notes || "—"}
            </p>
          </div>

          <div className="border-t pt-4">
            <Label className="text-base font-medium">{tr.owner}</Label>
            <div className="mt-2 space-y-2">
              {currentOwner && selectedOwnerId === currentOwner.id && (
                <p>
                  <Link
                    href={`/projects/${projectId}/owners/${currentOwner.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {currentOwner.full_name}
                  </Link>
                </p>
              )}
              {canWrite && (
                <select
                  className="form-select w-full max-w-md"
                  value={selectedOwnerId}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                >
                  <option value="">{tr.assignOwner}</option>
                  {owners?.results.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {(selectedOwnerId || currentOwner) && canWrite && (
            <div className="border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base font-medium">{tr.paymentPlan}</Label>
                {planLocked && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={requestPlanEdit}
                  >
                    {tr.changePaymentPlan}
                  </Button>
                )}
              </div>
              {planLocked && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {tr.savedPlanLocked}
                </p>
              )}
              {planDirty && planEditUnlocked && (
                <p className="mt-1 text-xs text-muted-foreground">{tr.savePlanHint}</p>
              )}
              <div className="relative mt-3">
                {planLocked && (
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent"
                    aria-label={tr.changePaymentPlan}
                    onClick={requestPlanEdit}
                  />
                )}
                <div
                  className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${planLocked ? "opacity-70" : ""}`}
                >
                <div>
                  <Label>{tr.totalOwed}</Label>
                  <MoneyInput
                    disabled={planLocked}
                    value={totalDisplay}
                    onChange={(display, api) => {
                      markPlanEdited();
                      setTotalDisplay(display);
                      setTotalApi(api);
                    }}
                  />
                </div>
                <div>
                  <Label>{tr.installments}</Label>
                  <Input
                    type="number"
                    min={1}
                    disabled={planLocked}
                    value={installmentCount}
                    onChange={(e) => {
                      markPlanEdited();
                      setInstallmentCount(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <Label>{tr.startDate}</Label>
                  <Input
                    type="date"
                    disabled={planLocked}
                    value={startDate}
                    onChange={(e) => {
                      markPlanEdited();
                      setStartDate(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <Label>{tr.monthlyPayment}</Label>
                  <p className="flex h-9 items-center text-lg font-semibold text-primary">
                    {monthlyPreview > 0 ? formatMoney(monthlyPreview, currency) : "—"}
                  </p>
                </div>
                </div>
              </div>
              <div className="relative mt-3">
                {planLocked && (
                  <button
                    type="button"
                    className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent"
                    aria-label={tr.changePaymentPlan}
                    onClick={requestPlanEdit}
                  />
                )}
                <div className={planLocked ? "opacity-70" : ""}>
                  <Label>{tr.notes}</Label>
                  <Textarea
                    disabled={planLocked}
                    value={planNotes}
                    onChange={(e) => {
                      markPlanEdited();
                      setPlanNotes(e.target.value);
                    }}
                    rows={2}
                  />
                </div>
              </div>
              {planEditUnlocked && plan && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetPlanFromSaved}
                  >
                    {tr.discardPlanChanges}
                  </Button>
                </div>
              )}

              {displaySchedule.length > 0 && (
                <TableScroll className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{tr.startDate}</TableHead>
                        <TableHead>{tr.expected}</TableHead>
                        <TableHead>{tr.paid}</TableHead>
                        <TableHead>{tr.remaining}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displaySchedule.map((row) => (
                        <TableRow key={row.installment}>
                          <TableCell label="#">{row.installment}</TableCell>
                          <TableCell label={tr.startDate}>{row.due_date}</TableCell>
                          <TableCell label={tr.expected}>
                            {formatMoney(row.expected, currency)}
                          </TableCell>
                          <TableCell label={tr.paid}>
                            {formatMoney(row.paid, currency)}
                          </TableCell>
                          <TableCell label={tr.remaining}>
                            {formatMoney(row.remaining, currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              )}
            </div>
          )}

          {canWrite && (
            <div className="flex justify-end border-t pt-4">
              <Button
                onClick={handleSaveCard}
                disabled={
                  !selectedOwnerId ||
                  setOwnerMutation.isPending ||
                  savePlanMutation.isPending
                }
              >
                {savePlanMutation.isPending ? tr.savingPlan : tr.save}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={changePlanDialogOpen} onOpenChange={setChangePlanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr.changePlanWarningTitle}</AlertDialogTitle>
            <AlertDialogDescription>{tr.changePlanWarningDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr.cancelChangePlan}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPlanEdit}>
              {tr.confirmChangePlan}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="lux-card mt-6">
        <CardHeader>
          <CardTitle>{tr.unitPayments}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite && currentOwner && (
            <RecordPaymentForm
              projectId={projectId}
              unitId={unitId}
              ownerId={currentOwner.id}
              ownerName={currentOwner.full_name}
              unitLabel={unit.unit_number}
              onSuccess={() => invalidateProjectLedger(qc, projectId)}
            />
          )}
          {canWrite && !currentOwner && (
            <p className="text-sm text-muted-foreground">{tr.assignOwnerToPay}</p>
          )}
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr.transactionDate}</TableHead>
                  <TableHead>{tr.owner}</TableHead>
                  <TableHead>{tr.amount}</TableHead>
                  <TableHead>{tr.status}</TableHead>
                  <TableHead>{tr.notes}</TableHead>
                  {canWrite && <TableHead>{tr.actions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 6 : 5}
                      className="mobile-table-message"
                    >
                      {tr.loading}
                    </TableCell>
                  </TableRow>
                )}
                {transactionsError && (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 6 : 5}
                      className="mobile-table-message text-destructive"
                    >
                      {formatApiError(transactionsQueryError)}
                    </TableCell>
                  </TableRow>
                )}
                {!transactionsLoading &&
                  !transactionsError &&
                  !visibleTransactions.length && (
                    <TableRow>
                      <TableCell
                        colSpan={canWrite ? 6 : 5}
                        className="mobile-table-message"
                      >
                        {tr.empty}
                      </TableCell>
                    </TableRow>
                  )}
                {visibleTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell label={tr.transactionDate}>
                      {formatDateDisplay(t.transaction_date)}
                    </TableCell>
                    <TableCell label={tr.owner}>
                      {owners?.results.find((o) => o.id === t.owner)?.full_name ?? "—"}
                    </TableCell>
                    <TableCell label={tr.amount}>
                      {formatMoney(t.amount, currency)}
                    </TableCell>
                    <TableCell label={tr.status}>
                      {t.entry_type === "REVERSAL" ? (
                        <Badge variant="secondary">{tr.reversalEntry}</Badge>
                      ) : t.status === "ACTIVE" ? (
                        <Badge>{tr.transactionPosted}</Badge>
                      ) : (
                        <Badge variant="destructive">
                          {statusLabels[t.status] ?? t.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell label={tr.notes}>{t.description || "—"}</TableCell>
                    {canWrite && (
                      <TableCell
                        label={tr.actions}
                        className="mobile-table-actions"
                      >
                        {t.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setVoidId(t.id)}
                          >
                            {tr.void}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        </CardContent>
      </Card>

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
