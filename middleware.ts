export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login (the sign-in page itself)
     * - /api/auth (NextAuth handlers)
     * - /_next (Next.js internals)
     * - /favicon.ico, /public assets
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
