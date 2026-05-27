"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { TableScroll } from "@/components/layout/table-scroll";
import { formatApiError } from "@/lib/api/errors";
import type { Paginated, SoftDeleteFields } from "@/lib/api/types";
import { tr } from "@/lib/i18n/tr";
import { cn } from "@/lib/utils";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "checkbox" | "date";
  options?: { value: string; label: string }[];
  required?: boolean;
  hideOnEdit?: boolean;
  /** Default for checkbox fields; defaults to true when omitted. */
  checkboxDefault?: boolean;
  /** Hide this field while the dialog form matches. */
  hidden?: (form: Record<string, unknown>) => boolean;
  /** Clear these form fields when this checkbox is turned on. */
  clearFieldsWhenChecked?: string[];
};

export type ColumnConfig<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type ResourcePageProps<T extends { id: string } & Partial<SoftDeleteFields>> = {
  title: string;
  hideTitle?: boolean;
  queryKey: string[];
  canWrite: boolean;
  canAdmin: boolean;
  softDelete?: boolean;
  columns: ColumnConfig<T>[];
  fields: FieldConfig[];
  fetchList: (params: Record<string, string | boolean | number>) => Promise<Paginated<T>>;
  createItem?: (data: Record<string, unknown>) => Promise<T>;
  updateItem?: (id: string, data: Record<string, unknown>) => Promise<T>;
  deleteItem?: (id: string) => Promise<void>;
  restoreItem?: (id: string) => Promise<T>;
  getInitialValues?: (row: T) => Record<string, unknown>;
};

export function ResourcePage<T extends { id: string } & Partial<SoftDeleteFields>>({
  title,
  hideTitle = false,
  queryKey,
  canWrite,
  canAdmin,
  softDelete = true,
  columns,
  fields,
  fetchList,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  getInitialValues,
}: ResourcePageProps<T>) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const params: Record<string, string | boolean | number> = { page };
  if (includeDeleted && canAdmin) params.include_deleted = true;

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => fetchList(params),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing && updateItem) return updateItem(editing.id, form);
      if (createItem) return createItem(form);
      throw new Error("No create handler");
    },
    onSuccess: () => {
      toast.success(tr.success);
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem!(id),
    onSuccess: () => {
      toast.success(tr.success);
      setDeleteId(null);
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreItem!(id),
    onSuccess: () => {
      toast.success(tr.success);
      invalidate();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const openCreate = () => {
    setEditing(null);
    const initial: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.type === "checkbox") initial[f.name] = f.checkboxDefault ?? true;
    });
    setForm(initial);
    setOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setForm(getInitialValues ? getInitialValues(row) : { ...row });
    setOpen(true);
  };

  const rows = data?.results ?? [];

  return (
    <div>
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center",
          hideTitle ? "sm:justify-end" : "sm:justify-between",
        )}
      >
        {!hideTitle && <h2 className="text-lg font-semibold">{title}</h2>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {softDelete && canAdmin && (
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={includeDeleted}
                onCheckedChange={setIncludeDeleted}
                id="include-deleted"
              />
              <Label htmlFor="include-deleted">{tr.showDeleted}</Label>
            </div>
          )}
          {canWrite && createItem && (
            <Button className="w-full sm:w-auto" onClick={openCreate}>
              {tr.create}
            </Button>
          )}
        </div>
      </div>

      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead>{tr.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="mobile-table-message"
                >
                  {tr.loading}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="mobile-table-message"
                >
                  {tr.empty}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.is_deleted ? "opacity-50" : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} label={c.label}>
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </TableCell>
                ))}
                <TableCell
                  label={tr.actions}
                  className="mobile-table-actions flex flex-wrap gap-1"
                >
                  {row.is_deleted && canAdmin && restoreItem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate(row.id)}
                    >
                      {tr.restore}
                    </Button>
                  )}
                  {!row.is_deleted && canWrite && updateItem && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      {tr.edit}
                    </Button>
                  )}
                  {!row.is_deleted && canWrite && deleteItem && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteId(row.id)}
                    >
                      {tr.delete}
                    </Button>
                  )}
                  {row.is_deleted && (
                    <Badge variant="secondary">{tr.voided}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroll>

      {data && data.count > 50 && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Önceki
          </Button>
          <Button
            variant="outline"
            disabled={!data.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? tr.edit : tr.create}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {fields
              .filter((field) => !(editing && field.hideOnEdit))
              .filter((field) => !field.hidden?.(form))
              .map((field) => (
              <div key={field.name} className="space-y-1">
                <Label>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    value={String(form[field.name] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.name]: e.target.value }))
                    }
                  />
                ) : field.type === "select" ? (
                  <select
                    className="form-select w-full"
                    value={String(form[field.name] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.name]: e.target.value }))
                    }
                  >
                    <option value="">Seçin</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <Switch
                    checked={Boolean(form[field.name])}
                    onCheckedChange={(v) =>
                      setForm((f) => {
                        const next = { ...f, [field.name]: v };
                        if (v && field.clearFieldsWhenChecked) {
                          for (const key of field.clearFieldsWhenChecked) {
                            next[key] = "";
                          }
                        }
                        return next;
                      })
                    }
                  />
                ) : (
                  <Input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={String(form[field.name] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [field.name]:
                          field.type === "number"
                            ? e.target.value
                              ? Number(e.target.value)
                              : ""
                            : e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
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
