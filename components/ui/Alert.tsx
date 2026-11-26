import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "slate" | "indigo" | "emerald" | "amber" | "red" | "sky";

const styles: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
};

export function Alert({
  tone = "slate",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("rounded-lg border px-4 py-3 text-sm", styles[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? (
        <div className={cn(title ? "mt-1" : undefined)}>{children}</div>
      ) : null}
    </div>
  );
}
