"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/lib/api/errors";
import type { Transaction, TransactionCategory } from "@/lib/api/types";
import { categoriesApi, transactionsApi } from "@/lib/api/resources";
import { tr } from "@/lib/i18n/tr";
import { invalidateProjectLedger } from "@/lib/query/invalidate-ledger";

type RecordSpendingFormProps = {
  projectId: string;
  categories: TransactionCategory[];
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function RecordSpendingForm({
  projectId,
  categories,
  onSuccess,
  onCancel,
}: RecordSpendingFormProps) {
  const qc = useQueryClient();
  const api = transactionsApi(projectId);
  const outflowCategories = categories.filter(
    (c) => c.direction_hint === "OUTFLOW" && !c.is_deleted
  );
  const [categoryId, setCategoryId] = useState(outflowCategories[0]?.id ?? "");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountApi, setAmountApi] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");

  const recordMutation = useMutation({
    mutationFn: async (): Promise<Transaction> => {
      const txn = await api.create({
        category: categoryId,
        amount: amountApi,
        transaction_date: transactionDate,
        direction: "OUTFLOW",
        description,
      });
      return api.post(txn.id);
    },
    onSuccess: async () => {
      try {
        toast.success(tr.spendingRecorded);
        setAmountDisplay("");
        setAmountApi("");
        setDescription("");
        setTransactionDate(new Date().toISOString().slice(0, 10));
        await invalidateProjectLedger(qc, projectId);
        onSuccess?.();
      } catch {
        /* saved; refresh can be retried */
      }
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  return (
    <div className="space-y-3">
      <div>
        <Label>{tr.spendingCategory}</Label>
        <select
          className="form-select w-full"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {outflowCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
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
        <Label>{tr.notes}</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            {tr.cancel}
          </Button>
        )}
        <Button
          onClick={() => {
            if (!categoryId) {
              toast.error(tr.spendingCategory);
              return;
            }
            if (!transactionDate) {
              toast.error(tr.transactionDateRequired);
              return;
            }
            recordMutation.mutate();
          }}
          disabled={!amountApi || !categoryId || recordMutation.isPending}
        >
          {recordMutation.isPending ? tr.savingPlan : tr.recordSpending}
        </Button>
      </div>
    </div>
  );
}

export function useOutflowCategories(projectId: string) {
  return useQuery({
    queryKey: ["categories", projectId, "outflow"],
    queryFn: () => categoriesApi(projectId).list(),
    select: (data) =>
      data.results.filter(
        (c) => c.direction_hint === "OUTFLOW" && !c.is_deleted
      ),
  });
}
