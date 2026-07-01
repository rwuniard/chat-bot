"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn("cognito", { callbackUrl: "/" })}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
    >
      Sign in with Cognito
    </button>
  );
}
