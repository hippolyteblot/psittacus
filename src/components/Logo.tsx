import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { emoji: "text-2xl", text: "text-lg", gap: "gap-2" },
  md: { emoji: "text-3xl", text: "text-xl", gap: "gap-2" },
  lg: { emoji: "text-5xl", text: "text-3xl", gap: "gap-3" },
  xl: { emoji: "text-7xl", text: "text-4xl", gap: "gap-4" },
};

export default function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <span
        className={`${s.emoji} select-none`}
        role="img"
        aria-label="Psittacus perroquet"
        style={{ filter: "drop-shadow(0 0 12px rgba(34,197,94,0.4))" }}
      >
        🦜
      </span>
      {showText && (
        <span
          className={`${s.text} font-bold tracking-tight gradient-text`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          Psittacus
        </span>
      )}
    </div>
  );
}
