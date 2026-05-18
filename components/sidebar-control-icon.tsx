"use client";

interface SidebarControlIconProps {
  kind: "sidebar" | "compose";
}

export function SidebarControlIcon({ kind }: SidebarControlIconProps) {
  if (kind === "sidebar") {
    return (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <rect x="3.5" y="4" width="17" height="16" rx="3" />
        <path d="M9 4v16" />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m4 20 4.2-1 9.5-9.5a2.4 2.4 0 1 0-3.4-3.4L4.8 15.6 4 20Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}
