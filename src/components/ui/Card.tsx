// src/components/ui/Card.tsx — SaaSable light surface (v1.9)
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  hover = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "surface rounded-2xl",
        "transition-all duration-200",
        hover && "hover:shadow-card-hover hover:border-brand-100",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between gap-3 p-6 pb-2", className)} {...props} />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-2", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-ink", className)}
      {...props}
    />
  );
}
