"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/lib/api/errors";
import type { Transaction } from "@/lib/api/types";
import { transactionsApi } from "@/lib/api/resources";
import { tr } from "@/lib/i18n/tr";
import { invalidateProjectLedger } from "@/lib/query/invalidate-ledger";

type RecordPaymentFormProps = {
  projectId: string;
  unitId: string;
  ownerId: string;
  ownerName: string;
  unitLabel: string;
  currency?: string;
  onSuccess?: () => void;
};

export function RecordPaymentForm({
  projectId,
  unitId,
  ownerId,
  ownerName,
  unitLabel,
  onSuccess,
}: RecordPaymentFormProps) {
  const qc = useQueryClient();
  const api = transactionsApi(projectId);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountApi, setAmountApi] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");

  const recordMutation = useMutation({
    mutationFn: async (): Promise<Transaction> => {
      const txn = await api.create({
        unit: unitId,
        owner: ownerId,
        amount: amountApi,
        transaction_date: transactionDate,
        direction: "INFLOW",
        description,
      });
      return api.post(txn.id);
    },
    onSuccess: async () => {
      try {
        toast.success(tr.paymentRecorded);
        setAmountDisplay("");
        setAmountApi("");
        setDescription("");
        setTransactionDate(new Date().toISOString().slice(0, 10));
        await invalidateProjectLedger(qc, projectId);
        onSuccess?.();
      } catch {
        /* payment saved; list refresh can be retried */
      }
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        {tr.unit}: <span className="font-medium text-foreground">{unitLabel}</span>
        {" · "}
        {tr.owner}: <span className="font-medium text-foreground">{ownerName}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{tr.amount}</Label>
          <MoneyInput
            value={amountDisplay}
            onChange={(display, apiAmount) => {
              setAmountDisplay(display);
              setAmountApi(apiAmount);
            }}
          />
        </div>
        <div>
          <Label>{tr.transactionDate}</Label>
          <Input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>{tr.paymentNotes}</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button
        onClick={() => {
          if (!transactionDate) {
            toast.error(tr.transactionDateRequired);
            return;
          }
          recordMutation.mutate();
        }}
        disabled={!amountApi || recordMutation.isPending}
      >
        {recordMutation.isPending ? tr.savingPlan : tr.recordPayment}
      </Button>
    </div>
  );
}
