"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";

type Step = "login" | "new-password";

const INPUT_CLASS =
  "w-full rounded-xl bg-[#1f1f1f] px-4 py-3 text-sm text-stone-100 placeholder-stone-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500";

const LABEL_CLASS = "block text-sm font-medium text-stone-300 mb-1.5";

const SUBMIT_CLASS =
  "flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

export function LoginForm() {
  const router = useRouter();

  // Form refs let us programmatically submit on Enter (same as clicking the button).
  const loginFormRef = useRef<HTMLFormElement>(null);
  const newPasswordFormRef = useRef<HTMLFormElement>(null);

  // Input refs let us move focus to the next field when Enter is pressed.
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cognitoSession, setCognitoSession] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function completeSignIn(token: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      setError("Sign-in failed. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/cognito/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Authentication failed");
        return;
      }
      if (data.requiresNewPassword) {
        setCognitoSession(data.session);
        setStep("new-password");
        return;
      }
      await completeSignIn(data.token);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cognito/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword, cognitoSession }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to set new password");
        return;
      }
      await completeSignIn(data.token);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Keyboard shortcuts (Enter) ---
  // Multi-field forms don't always submit reliably on Enter across browsers.
  // We define explicit behavior so users never need to tab to or click the button.

  /** Username + Enter → jump to password (don't submit yet). */
  function handleUsernameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    // Stop the browser from submitting before the password is filled in.
    event.preventDefault();
    passwordInputRef.current?.focus();
  }

  /** Password + Enter → submit the sign-in form (triggers handleLogin via onSubmit). */
  function handlePasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || loading) {
      return;
    }

    event.preventDefault();
    // requestSubmit() runs validation and onSubmit, unlike calling handleLogin directly.
    loginFormRef.current?.requestSubmit();
  }

  /** New password + Enter → jump to confirm-password field. */
  function handleNewPasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    confirmPasswordInputRef.current?.focus();
  }

  /** Confirm password + Enter → submit the new-password form. */
  function handleConfirmPasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || loading) {
      return;
    }

    event.preventDefault();
    newPasswordFormRef.current?.requestSubmit();
  }

  if (step === "new-password") {
    return (
      <form ref={newPasswordFormRef} onSubmit={handleNewPassword} className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-base font-semibold text-stone-100">Set a new password</h2>
          <p className="text-sm text-stone-400">Your account requires a new password before signing in.</p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <div>
          <label className={LABEL_CLASS} htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Enter new password"
            required
            autoFocus
            autoComplete="new-password"
            onKeyDown={handleNewPasswordKeyDown}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="confirm-password">Confirm password</label>
          <input
            ref={confirmPasswordInputRef}
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
            onKeyDown={handleConfirmPasswordKeyDown}
          />
        </div>

        <ul className="space-y-1 px-1 text-xs text-stone-500">
          <li>• Minimum 8 characters</li>
          <li>• At least one uppercase letter</li>
          <li>• At least one number</li>
          <li>• At least one special character</li>
        </ul>

        <button type="submit" disabled={loading} className={SUBMIT_CLASS}>
          {loading ? "Setting password…" : "Set password & sign in"}
        </button>
      </form>
    );
  }

  return (
    <form ref={loginFormRef} onSubmit={handleLogin} className="flex w-full flex-col gap-5">
      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      <div>
        <label className={LABEL_CLASS} htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Enter your username"
          required
          autoFocus
          autoComplete="username"
          onKeyDown={handleUsernameKeyDown}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="password">Password</label>
        <input
          ref={passwordInputRef}
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          onKeyDown={handlePasswordKeyDown}
        />
      </div>

      <button type="submit" disabled={loading} className={SUBMIT_CLASS}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
