import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"

// ── Session lifetimes (seconds) ────────────────────────────────────────────
const IDLE_TIMEOUT = 15 * 60        // 15 min of inactivity ends the session
const ABSOLUTE_MAX = 5 * 60 * 60    // 5 h hard cap regardless of activity
const ABSOLUTE_MAX_KEEP = 30 * 24 * 60 * 60 // "keep me logged in" cap (30 days)

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Sign the JWT with the SAME secret (and precedence) the proxy verifies with
  // (proxy.ts uses `NEXTAUTH_SECRET ?? AUTH_SECRET`). If these differ, the login
  // cookie can't be verified by middleware and the user bounces back to login.
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  // Required behind a proxy / on custom domains so NextAuth trusts the host.
  trustHost: true,
  logger: {
    error() { }, // suppress CredentialsSignin noise in the console
  },
  providers: [
    Credentials({
      credentials: {
        userId: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" },
        keepLoggedIn: { label: "Keep me logged in", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.userId || !credentials?.password) return null

        // Accept either the local part (e.g. "4211230210") or a full email
        const raw = credentials.userId as string
        const email = raw.includes("@") ? raw : `${raw}@live.gctu.edu.gh`

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!passwordMatch) return null

        return {
          id: String(user.id),
          email: user.email,
          role: user.role,
          name: user.name,
          mustChangePassword: user.mustChangePassword,
          keepLoggedIn: credentials.keepLoggedIn === "true",
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Idle timeout (the "access token"): 15 min of inactivity ends the session.
    // It's a sliding window — each request within the window resets it.
    maxAge: IDLE_TIMEOUT,
    // Re-issue (slide) the cookie at most this often while the user is active.
    updateAge: 5 * 60,
  },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, user }) {
      const nowSec = Math.floor(Date.now() / 1000)
      if (user) {
        const u = user as any
        token.email = u.email
        token.role = u.role
        token.mustChangePassword = u.mustChangePassword
        // Absolute cap (the "refresh token"): hard expiry regardless of activity.
        // "Keep me logged in" extends the cap; otherwise 5 hours.
        token.absoluteExp =
          nowSec + (u.keepLoggedIn ? ABSOLUTE_MAX_KEEP : ABSOLUTE_MAX)
      }
      // Flag the token once it passes the absolute cap so the proxy + session
      // can treat it as logged-out (the sliding maxAge alone can't enforce this).
      if (typeof token.absoluteExp === "number" && nowSec > token.absoluteExp) {
        token.expired = true
      }
      return token
    },
    async session({ session, token }) {
      session.user.email = token.email as string
      session.user.role = token.role as "ADMIN" | "LECTURER" | "STUDENT"
      session.user.mustChangePassword = token.mustChangePassword as boolean
      ;(session as any).expired = token.expired === true
      ;(session as any).absoluteExp = token.absoluteExp ?? null
      return session
    },
  },
})
