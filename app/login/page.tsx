import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1f1f1f]">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl bg-[#2c2c2c] px-8 py-10 shadow-xl ring-1 ring-white/8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-stone-100">Welcome back</h1>
          <p className="text-sm text-stone-400">Sign in to access the chat bot</p>
        </div>
        <SignInButton />
      </div>
    </main>
  );
}
