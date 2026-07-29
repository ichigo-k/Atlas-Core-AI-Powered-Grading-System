import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validCidr } from "@/lib/access-control"

export async function GET() {
  try {
    const session = await auth()
    if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await prisma.trustedNetwork.findMany({ orderBy: { name: "asc" } }))
  } catch (error) {
    console.error("[GET /api/admin/trusted-networks]", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await request.json()
    const cidrs = String(body.cidrs ?? "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)
    if (!String(body.name ?? "").trim() || cidrs.length === 0 || !cidrs.every(validCidr)) {
      return NextResponse.json({ error: "Enter a name and valid IP/CIDR ranges." }, { status: 400 })
    }
    const network = await prisma.trustedNetwork.create({ data: { name: body.name.trim(), description: body.description?.trim() || null, cidrs } })
    return NextResponse.json(network, { status: 201 })
  } catch (error) {
    console.error("[POST /api/admin/trusted-networks]", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
