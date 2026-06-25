import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
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
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any
        token.email = u.email
        token.role = u.role
        token.mustChangePassword = u.mustChangePassword
        token.maxAge = u.keepLoggedIn ? 30 * 24 * 60 * 60 : 8 * 60 * 60
      }
      return token
    },
    async session({ session, token }) {
      session.user.email = token.email as string
      session.user.role = token.role as "ADMIN" | "LECTURER" | "STUDENT"
      session.user.mustChangePassword = token.mustChangePassword as boolean
      return session
    },
  },
})
