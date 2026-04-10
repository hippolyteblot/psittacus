import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "highlight";
  padding?: "sm" | "md" | "lg";
}

const variantStyles = {
  default: "bg-surface-200 border border-surface-300/50",
  glass: "glass",
  highlight:
    "bg-gradient-to-br from-parrot-900/40 to-surface-200 border border-parrot-700/40",
};

const paddingStyles = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({
  variant = "default",
  padding = "md",
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-2xl",
        variantStyles[variant],
        paddingStyles[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
