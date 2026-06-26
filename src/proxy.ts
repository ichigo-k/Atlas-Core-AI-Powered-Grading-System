import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: "/admin",
  LECTURER: "/lecturer",
  STUDENT: "/student",
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  // NextAuth v5 uses "authjs.session-token" (HTTP) or "__Secure-authjs.session-token" (HTTPS).
  // getToken defaults to the old v4 name, so we must pass the correct one explicitly.
  const secureCookie = request.nextUrl.protocol === "https:"
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
  const token = await getToken({ req: request, secret, cookieName })

  // Enforce the absolute (refresh) cap: even within the 15-min idle window, a
  // token past its absoluteExp is treated as logged out.
  const nowSec = Math.floor(Date.now() / 1000)
  const absoluteExpired =
    !!token &&
    typeof token.absoluteExp === "number" &&
    nowSec > token.absoluteExp

  const isAuthenticated = !!token && token.expired !== true && !absoluteExpired
  const role = token?.role as string | undefined

  // Authenticated user on login page → redirect to their dashboard
  if (pathname === "/" && isAuthenticated && role) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARDS[role] ?? "/", request.url)
    )
  }

  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/lecturer") ||
    pathname.startsWith("/student") ||
    pathname === "/force-change-password"

  if (!isProtected) return NextResponse.next()

  // Unauthenticated → login page
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Bypass role prefix checks for shared auth pages
  if (pathname === "/force-change-password") {
    return NextResponse.next()
  }

  // Cross-role access → own dashboard
  const allowedPrefix = role ? ROLE_DASHBOARDS[role] : null
  if (!allowedPrefix || !pathname.startsWith(allowedPrefix)) {
    return NextResponse.redirect(
      new URL(allowedPrefix ?? "/", request.url)
    )
  }

  const response = NextResponse.next()
  // Forward pathname so server layouts can read it (e.g. to hide nav on exam pages)
  response.headers.set("x-pathname", pathname)
  return response
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/lecturer/:path*",
    "/student/:path*",
    "/force-change-password",
  ],
}
