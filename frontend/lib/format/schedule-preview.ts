export type SchedulePreviewRow = {
  installment: number;
  due_date: string;
  expected: number;
  paid: number;
  remaining: number;
};

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const monthIndex = m - 1 + months;
  const year = y + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildSchedulePreview(
  totalAmount: number,
  installmentCount: number,
  startDate: string
): SchedulePreviewRow[] {
  if (totalAmount <= 0 || installmentCount < 1 || !startDate) return [];
  const monthly = Math.round((totalAmount / installmentCount) * 100) / 100;
  const rows: SchedulePreviewRow[] = [];
  for (let i = 0; i < installmentCount; i++) {
    rows.push({
      installment: i + 1,
      due_date: addMonths(startDate, i),
      expected: monthly,
      paid: 0,
      remaining: monthly,
    });
  }
  return rows;
}
