import React from "react";

type BadgeVariant = "default" | "green" | "amber" | "red" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-300/60 text-surface-800",
  green: "bg-parrot-500/15 text-parrot-300 border border-parrot-500/20",
  amber: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
  red: "bg-red-500/15 text-red-300 border border-red-500/20",
  blue: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
};

export default function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
