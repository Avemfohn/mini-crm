"use client";

import { Input } from "@/components/ui/input";
import {
  digitsOnly,
  formatAmountDisplay,
  parseAmountToApi,
} from "@/lib/format/amount";

type MoneyInputProps = {
  value: string;
  onChange: (displayValue: string, apiValue: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
};

export function MoneyInput({
  value,
  onChange,
  disabled,
  id,
  placeholder = "0",
}: MoneyInputProps) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const digits = digitsOnly(raw);
        const display = digits ? formatAmountDisplay(digits) : "";
        const api = digits ? parseAmountToApi(digits) : "";
        onChange(display, api);
      }}
    />
  );
}
