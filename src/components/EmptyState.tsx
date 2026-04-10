import React from "react";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  emoji = "📭",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6"
      style={{ animation: "var(--animate-fade-in)" }}
    >
      <span className="text-5xl" role="img" aria-hidden>
        {emoji}
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-surface-900 text-lg">{title}</p>
        {description && (
          <p className="text-surface-600 text-sm leading-relaxed max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
