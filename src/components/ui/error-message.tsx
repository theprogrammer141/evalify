import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorMessage({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      className={cn("flex items-start gap-2 text-sm text-destructive", className)}
      role="alert"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
