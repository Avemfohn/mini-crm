/** ISO date (YYYY-MM-DD) → Turkish display dd.MM.yyyy */
export function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}
