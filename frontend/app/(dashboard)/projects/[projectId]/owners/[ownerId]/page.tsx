"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ownershipsApi,
  ownersApi,
  paymentPlansApi,
  projectsApi,
  transactionsApi,
  unitsApi,
} from "@/lib/api/resources";
import { formatDateDisplay } from "@/lib/format/date";
import { statusLabels, tr } from "@/lib/i18n/tr";

function formatMoney(amount: string, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export default function OwnerDetailPage() {
  const { projectId, ownerId } = useParams<{ projectId: string; ownerId: string }>();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: owner, isLoading } = useQuery({
    queryKey: ["owner", projectId, ownerId],
    queryFn: () => ownersApi(projectId).get(ownerId),
  });

  const { data: ownerships } = useQuery({
    queryKey: ["ownerships", projectId, ownerId],
    queryFn: () => ownershipsApi(projectId).list(),
  });

  const { data: units } = useQuery({
    queryKey: ["units", projectId],
    queryFn: () => unitsApi(projectId).list(),
  });

  const unitMap = new Map(units?.results.map((u) => [u.id, u.unit_number]) ?? []);

  const { data: plans } = useQuery({
    queryKey: ["payment-plans", projectId, "owner", ownerId],
    queryFn: () => paymentPlansApi(projectId).list({ owner: ownerId }),
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", projectId, "owner", ownerId],
    queryFn: () => transactionsApi(projectId).list({ owner: ownerId }),
  });

  const currency = project?.currency ?? "TRY";
  const ownerUnits =
    ownerships?.results.filter((o) => o.owner.id === ownerId) ?? [];

  if (isLoading) return <p>{tr.loading}</p>;
  if (!owner) return null;

  return (
    <div>
      <PageHeader
        title={`${tr.ownerDetail}: ${owner.full_name}`}
        description={project?.name}
        actions={
          <Link href={`/projects/${projectId}/owners`}>
            <Button variant="outline" type="button">
              {tr.back}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lux-card">
          <CardHeader>
            <CardTitle>{tr.owner}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{tr.phone}: </span>
              {owner.phone || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{tr.email}: </span>
              {owner.email || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{tr.nationalId}: </span>
              {owner.national_id || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">{tr.notes}: </span>
              {owner.notes || "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="lux-card">
          <CardHeader>
            <CardTitle>{tr.ownerUnits}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ownerUnits.length === 0 && (
              <p className="text-sm text-muted-foreground">{tr.empty}</p>
            )}
            {ownerUnits.map((o) => (
              <Link
                key={o.id}
                href={`/projects/${projectId}/units/${o.unit}`}
                className="block text-primary hover:underline"
              >
                {tr.unit} {unitMap.get(o.unit) ?? o.unit}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {plans && plans.results.length > 0 && (
        <Card className="lux-card mt-6">
          <CardHeader>
            <CardTitle>{tr.paymentPlan}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plans.results.map((plan) => (
              <div key={plan.id} className="space-y-2">
                <p className="text-sm font-medium">
                  <Link
                    href={`/projects/${projectId}/units/${typeof plan.unit === "object" ? plan.unit.id : plan.unit}`}
                    className="text-primary hover:underline"
                  >
                    Daire{" "}
                    {typeof plan.unit === "object"
                      ? plan.unit.unit_number
                      : plan.unit}
                  </Link>
                  {" — "}
                  {formatMoney(plan.total_amount, currency)} / {plan.installment_count}{" "}
                  {tr.installments.toLowerCase()}
                </p>
                <div className="lux-table overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{tr.expected}</TableHead>
                        <TableHead>{tr.paid}</TableHead>
                        <TableHead>{tr.remaining}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.schedule.map((row) => (
                        <TableRow key={row.installment}>
                          <TableCell>{row.installment}</TableCell>
                          <TableCell>{formatMoney(row.expected, currency)}</TableCell>
                          <TableCell>{formatMoney(row.paid, currency)}</TableCell>
                          <TableCell>{formatMoney(row.remaining, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="lux-card mt-6">
        <CardHeader>
          <CardTitle>{tr.transactions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="lux-table overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr.transactionDate}</TableHead>
                  <TableHead>{tr.amount}</TableHead>
                  <TableHead>{tr.status}</TableHead>
                  <TableHead>{tr.notes}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.results.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDateDisplay(t.transaction_date)}</TableCell>
                    <TableCell>{formatMoney(t.amount, currency)}</TableCell>
                    <TableCell>{statusLabels[t.status] ?? t.status}</TableCell>
                    <TableCell>{t.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
