/** Turkish-style amount display: 1.000.000 (dots as thousand separators). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatAmountDisplay(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(
    Number(digits)
  );
}

/** API decimal string e.g. "1000000.00" */
export function parseAmountToApi(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return `${Number(digits)}.00`;
}

export function formatAmountFromApi(apiValue: string): string {
  const n = Math.round(Number(apiValue));
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatAmountDisplay(String(n));
}
