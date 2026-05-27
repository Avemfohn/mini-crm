"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatApiError } from "@/lib/api/errors";
import {
  blocksApi,
  categoriesApi,
  ownersApi,
  paymentPlansApi,
  projectsApi,
  transactionsApi,
  unitsApi,
} from "@/lib/api/resources";
import { useAuth } from "@/lib/auth/context";
import { canWriteProject } from "@/lib/auth/permissions";
import { formatDateDisplay } from "@/lib/format/date";
import { statusLabels, tr } from "@/lib/i18n/tr";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { getRole } = useAuth();
  const role = getRole(projectId);
  const canWrite = canWriteProject(role);
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: blocks } = useQuery({
    queryKey: ["blocks", projectId],
    queryFn: () => blocksApi(projectId).list(),
  });

  const { data: units } = useQuery({
    queryKey: ["units", projectId, "summary"],
    queryFn: () => unitsApi(projectId).list(),
  });

  const { data: owners } = useQuery({
    queryKey: ["owners", projectId, "summary"],
    queryFn: () => ownersApi(projectId).list(),
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", projectId, "summary"],
    queryFn: () => transactionsApi(projectId).list({ status: "ACTIVE" }),
  });

  const { data: paymentPlans } = useQuery({
    queryKey: ["payment-plans", projectId, "summary"],
    queryFn: () => paymentPlansApi(projectId).list(),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", projectId, "summary"],
    queryFn: () => categoriesApi(projectId).list(),
  });

  const block = blocks?.results[0];

  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    address: "",
    description: "",
    currency: "TRY",
    status: "ACTIVE",
  });

  const [blockForm, setBlockForm] = useState({ name: "", code: "" });

  useEffect(() => {
    if (project) {
      setProjectForm({
        name: project.name,
        code: project.code,
        address: project.address ?? "",
        description: project.description ?? "",
        currency: project.currency,
        status: project.status,
      });
    }
  }, [project]);

  useEffect(() => {
    if (block) {
      setBlockForm({ name: block.name, code: block.code });
    }
  }, [block]);

  const summary = useMemo(() => {
    const currency = project?.currency ?? "TRY";
    let inflow = 0;
    let outflow = 0;
    const byOwner = new Map<string, { name: string; total: number }>();

    const ownerMap = new Map(
      owners?.results.map((o) => [o.id, o.full_name]) ?? []
    );

    transactions?.results.forEach((t) => {
      // İptal karşılığı (REVERSAL) kayıtları özette sayılmaz; iptal sadece girişi düşürür.
      if (t.entry_type !== "STANDARD") return;
      const amt = Number(t.amount);
      if (t.direction === "INFLOW") inflow += amt;
      else outflow += amt;
      if (t.owner && t.direction === "INFLOW") {
        const name = ownerMap.get(t.owner) ?? t.owner;
        const prev = byOwner.get(t.owner) ?? { name, total: 0 };
        prev.total += amt;
        byOwner.set(t.owner, prev);
      }
    });

    let pendingInstallments = 0;
    paymentPlans?.results.forEach((plan) => {
      plan.schedule.forEach((row) => {
        if (Number(row.remaining) > 0) pendingInstallments += 1;
      });
    });

    const categoryMap = new Map(
      categories?.results.map((c) => [c.id, c.name]) ?? []
    );
    const recentSpendings = (transactions?.results ?? [])
      .filter(
        (t) =>
          t.entry_type === "STANDARD" &&
          t.status === "ACTIVE" &&
          t.direction === "OUTFLOW" &&
          !t.unit &&
          !t.owner
      )
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        date: t.transaction_date,
        category: categoryMap.get(t.category) ?? "—",
        amount: Number(t.amount),
        description: t.description,
      }));

    return {
      currency,
      inflow,
      outflow,
      unitCount: units?.count ?? units?.results.length ?? 0,
      ownerCount: owners?.count ?? owners?.results.length ?? 0,
      pendingInstallments,
      byOwner: Array.from(byOwner.values()).sort((a, b) => b.total - a.total),
      recentSpendings,
    };
  }, [transactions, owners, units, project, paymentPlans, categories]);

  const saveProjectMutation = useMutation({
    mutationFn: () => projectsApi.update(projectId, projectForm),
    onSuccess: () => {
      toast.success(tr.success);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const saveBlockMutation = useMutation({
    mutationFn: () => {
      if (!block) throw new Error("No block");
      return blocksApi(projectId).update(block.id, blockForm);
    },
    onSuccess: () => {
      toast.success(tr.success);
      qc.invalidateQueries({ queryKey: ["blocks", projectId] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  if (isLoading) return <p>{tr.loading}</p>;
  if (!project) return null;

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.code}
        actions={
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href={`/projects/${projectId}/units`} className="block">
              <Button variant="outline" type="button" className="w-full">
                {tr.quickAddUnit}
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/owners`} className="block">
              <Button variant="outline" type="button" className="w-full">
                {tr.quickAddOwner}
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/transactions`} className="block">
              <Button type="button" className="w-full">
                {tr.quickAddPayment}
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/spendings`} className="block">
              <Button variant="outline" type="button" className="w-full">
                {tr.recordSpending}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="lux-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tr.totalInflow}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">
              {formatMoney(summary.inflow, summary.currency)}
            </p>
          </CardContent>
        </Card>
        <Card className="lux-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tr.totalOutflow}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(summary.outflow, summary.currency)}
            </p>
            <Link
              href={`/projects/${projectId}/spendings`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              {tr.viewSpendings}
            </Link>
          </CardContent>
        </Card>
        <Card className="lux-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tr.unitCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.unitCount}</p>
          </CardContent>
        </Card>
        <Card className="lux-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tr.ownerCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.ownerCount}</p>
          </CardContent>
        </Card>
        <Card className="lux-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tr.pendingInstallments}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.pendingInstallments}</p>
          </CardContent>
        </Card>
      </div>

      {summary.recentSpendings.length > 0 && (
        <Card className="lux-card mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{tr.recentSpendings}</CardTitle>
            <Link
              href={`/projects/${projectId}/spendings`}
              className="text-sm text-primary hover:underline"
            >
              {tr.viewSpendings}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.recentSpendings.map((s) => (
              <div key={s.id} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {formatDateDisplay(s.date)} · {s.category}
                  {s.description ? ` — ${s.description}` : ""}
                </span>
                <span className="font-medium">
                  {formatMoney(s.amount, summary.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.byOwner.length > 0 && (
        <Card className="lux-card mb-6">
          <CardHeader>
            <CardTitle>{tr.ownerPayments}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.byOwner.map((o) => (
              <div key={o.name} className="flex justify-between text-sm">
                <span>{o.name}</span>
                <span className="font-medium text-primary">
                  {formatMoney(o.total, summary.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lux-card">
          <CardHeader>
            <CardTitle>{tr.editProject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{tr.projectName}</Label>
              <Input
                value={projectForm.name}
                disabled={!canWrite}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.projectCode}</Label>
              <Input value={projectForm.code} disabled />
            </div>
            <div>
              <Label>{tr.address}</Label>
              <Input
                value={projectForm.address}
                disabled={!canWrite}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.description}</Label>
              <Textarea
                value={projectForm.description}
                disabled={!canWrite}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.currency}</Label>
              <Input
                value={projectForm.currency}
                disabled={!canWrite}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, currency: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.status}</Label>
              <select
                className="form-select w-full disabled:opacity-50"
                value={projectForm.status}
                disabled={!canWrite}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            {canWrite && (
              <Button
                onClick={() => saveProjectMutation.mutate()}
                disabled={saveProjectMutation.isPending}
              >
                {tr.saveProject}
              </Button>
            )}
          </CardContent>
        </Card>

        {block && (
          <Card className="lux-card">
            <CardHeader>
              <CardTitle>{tr.blocks}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{tr.blockName}</Label>
                <Input
                  value={blockForm.name}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setBlockForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{tr.blockCode}</Label>
                <Input
                  value={blockForm.code}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setBlockForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </div>
              {canWrite && (
                <Button
                  onClick={() => saveBlockMutation.mutate()}
                  disabled={saveBlockMutation.isPending}
                >
                  {tr.saveBlock}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
