import type { QueryClient } from "@tanstack/react-query";

export function invalidateProjectLedger(qc: QueryClient, projectId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["transactions", projectId] }),
    qc.invalidateQueries({ queryKey: ["ledger-inflow", projectId] }),
    qc.invalidateQueries({ queryKey: ["ledger-outflow", projectId] }),
    qc.invalidateQueries({ queryKey: ["payment-plans", projectId] }),
  ]);
}
