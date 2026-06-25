import type { DefaultSession } from "next-auth"
import type { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      role: "ADMIN" | "LECTURER" | "STUDENT"
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    mustChangePassword?: boolean
    maxAge?: number
  }
}
