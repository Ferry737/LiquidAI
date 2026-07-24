// src/components/ui/Card.tsx
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
        "rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-glow",
        "transition-all duration-200",
        hover && "hover:shadow-glow-hover hover:border-white/10",
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
  return <div className={cn("p-6 pb-2", className)} {...props} />;
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
      className={cn(
        "text-sm font-medium text-white/60 tracking-wide",
        className
      )}
      {...props}
    />
  );
}
