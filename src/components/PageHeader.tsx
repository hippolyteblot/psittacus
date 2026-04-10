"use client";
import React from "react";
import { useRouter } from "next/navigation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  backLabel?: string;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  back = false,
  backLabel = "Retour",
  action,
}: PageHeaderProps) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-3 px-4 py-4">
      {back && (
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-surface-700 hover:text-surface-900 hover:bg-surface-200/60 transition-all active:scale-90 shrink-0"
          aria-label={backLabel}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m0 0 7 7M5 12l7-7" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1
          className="font-bold text-surface-900 text-xl leading-tight truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-surface-600 text-sm truncate">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
