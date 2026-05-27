import Image from "next/image";
import Link from "next/link";
import logoSrc from "@/assets/brand-logo.png";
import { tr } from "@/lib/i18n/tr";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "sidebar" | "login";
  linked?: boolean;
  className?: string;
};

export function BrandLogo({
  variant = "sidebar",
  linked = true,
  className,
}: BrandLogoProps) {
  const image = (
    <Image
      src={logoSrc}
      alt={tr.appBrand}
      width={variant === "login" ? 280 : 200}
      height={variant === "login" ? 160 : 72}
      className={cn(
        "h-auto w-auto object-contain",
        variant === "login" ? "max-h-36 max-w-[min(280px,100%)]" : "max-h-16 max-w-full",
        className
      )}
      priority={variant === "login"}
    />
  );

  if (!linked) {
    return image;
  }

  return (
    <Link
      href="/projects"
      className={cn(
        "block w-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md",
        variant === "login" && "mx-auto"
      )}
    >
      {image}
    </Link>
  );
}
