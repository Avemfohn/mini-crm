"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { formatApiError } from "@/lib/api/errors";
import { projectsApi } from "@/lib/api/resources";
import type { Project } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { canAdminProject, canCreateProject } from "@/lib/auth/permissions";
import { statusLabels, tr } from "@/lib/i18n/tr";
import type { RoleCode } from "@/lib/i18n/tr";

const emptyForm = {
  name: "",
  code: "",
  address: "",
  description: "",
  currency: "TRY",
  status: "ACTIVE",
};

export default function ProjectsPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const params: Record<string, string | boolean> = {};
  if (includeDeleted) params.include_deleted = true;

  const { data, isLoading } = useQuery({
    queryKey: ["projects", params],
    queryFn: () => projectsApi.list(params),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return projectsApi.update(editing.id, form);
      return projectsApi.create(form);
    },
    onSuccess: () => {
      toast.success(tr.success);
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      toast.success(tr.success);
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => projectsApi.restore(id),
    onSuccess: () => {
      toast.success(tr.success);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const getRole = (projectId: string) => {
    const m = me?.memberships.find((x) => x.project.id === projectId);
    return m?.role.code as RoleCode | undefined;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code,
      address: p.address ?? "",
      description: p.description ?? "",
      currency: p.currency,
      status: p.status,
    });
    setOpen(true);
  };

  const isAdminAny =
    me?.user.is_superuser ||
    me?.memberships.some((m) => m.is_active && m.role.code === "ADMIN");

  const projects = data?.results ?? [];

  const renderStatus = (p: Project) =>
    p.is_deleted ? (
      <Badge variant="secondary" className="text-xs">
        {tr.voided}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-xs font-normal">
        {statusLabels[p.status] ?? p.status}
      </Badge>
    );

  const renderAdminActions = (p: Project, canAdmin: boolean) => {
    if (!canAdmin) return null;
    if (p.is_deleted) {
      return (
        <Button
          size="xs"
          variant="outline"
          className="h-7"
          onClick={() => restoreMutation.mutate(p.id)}
        >
          {tr.restore}
        </Button>
      );
    }
    return (
      <>
        <Button size="xs" variant="outline" className="h-7" onClick={() => openEdit(p)}>
          {tr.edit}
        </Button>
        <Button
          size="xs"
          variant="destructive"
          className="h-7"
          onClick={() => setDeleteId(p.id)}
        >
          {tr.delete}
        </Button>
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={tr.projects}
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {isAdminAny && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs sm:text-sm">
                <Label htmlFor="show-deleted-projects" className="leading-tight">
                  {tr.showDeleted}
                </Label>
                <Switch
                  checked={includeDeleted}
                  onCheckedChange={setIncludeDeleted}
                  id="show-deleted-projects"
                />
              </div>
            )}
            {canCreateProject(me) && (
              <Button size="sm" className="h-9 shrink-0 sm:w-auto" onClick={openCreate}>
                {tr.createProject}
              </Button>
            )}
          </div>
        }
      />

      {/* Mobile: compact cards, full width */}
      <div className="space-y-2 md:hidden">
        {isLoading && (
          <p className="py-6 text-center text-sm text-muted-foreground">{tr.loading}</p>
        )}
        {!isLoading && projects.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{tr.empty}</p>
        )}
        {projects.map((p) => {
          const role = getRole(p.id);
          const canAdmin = canAdminProject(role ?? null, me);
          return (
            <article
              key={p.id}
              className={`rounded-lg border border-border/70 bg-card p-3 shadow-sm ${
                p.is_deleted ? "opacity-60" : ""
              }`}
            >
              <Link href={`/projects/${p.id}`} className="block min-w-0">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {p.code}
                </p>
              </Link>
              <div className="mt-2 flex items-center justify-between gap-2">
                {renderStatus(p)}
                {canAdmin && (
                  <div className="flex shrink-0 gap-1">{renderAdminActions(p, canAdmin)}</div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr.name}</TableHead>
                <TableHead>{tr.code}</TableHead>
                <TableHead>{tr.status}</TableHead>
                <TableHead>{tr.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="mobile-table-message">
                    {tr.loading}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="mobile-table-message">
                    {tr.empty}
                  </TableCell>
                </TableRow>
              )}
              {projects.map((p) => {
                const role = getRole(p.id);
                const canAdmin = canAdminProject(role ?? null, me);
                return (
                  <TableRow key={p.id} className={p.is_deleted ? "opacity-50" : undefined}>
                    <TableCell label={tr.name}>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell label={tr.code} className="font-mono text-sm">
                      {p.code}
                    </TableCell>
                    <TableCell label={tr.status}>{renderStatus(p)}</TableCell>
                    <TableCell
                      label={tr.actions}
                      className="mobile-table-actions flex flex-wrap gap-1"
                    >
                      {renderAdminActions(p, canAdmin)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableScroll>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? tr.editProject : tr.createProject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr.projectName}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr.projectCode}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                disabled={!!editing}
              />
            </div>
            <div>
              <Label>{tr.address}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr.description}</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{tr.currency}</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              />
            </div>
            <div>
              <Label>{tr.status}</Label>
              <select
                className="form-select w-full"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tr.cancel}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {tr.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{tr.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {tr.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
