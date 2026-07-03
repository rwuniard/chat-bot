"use client";

interface SignOutButtonProps {
  readonly cognitoLogoutUrl: string;
}

export function SignOutButton({ cognitoLogoutUrl }: Readonly<SignOutButtonProps>) {
  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    globalThis.location.href = cognitoLogoutUrl;
  }

  return (
    <button
      onClick={handleSignOut}
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-400 transition hover:bg-white/6 hover:text-stone-200"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Sign out
    </button>
  );
}
