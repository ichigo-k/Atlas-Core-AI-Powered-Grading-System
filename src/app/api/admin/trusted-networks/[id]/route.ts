import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validCidr } from "@/lib/access-control"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    const body = await request.json()
    const cidrs = String(body.cidrs ?? "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)
    if (!String(body.name ?? "").trim() || cidrs.length === 0 || !cidrs.every(validCidr)) return NextResponse.json({ error: "Invalid network details." }, { status: 400 })
    return NextResponse.json(await prisma.trustedNetwork.update({ where: { id: Number(id) }, data: { name: body.name.trim(), description: body.description?.trim() || null, cidrs, enabled: body.enabled !== false } }))
  } catch (error) {
    console.error("[PUT /api/admin/trusted-networks/[id]]", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    const networkId = Number(id)
    await prisma.$transaction([
      prisma.assessment.updateMany({ where: { trustedNetworkId: networkId }, data: { requireTrustedNetwork: false, trustedNetworkId: null } }),
      prisma.trustedNetwork.delete({ where: { id: networkId } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/admin/trusted-networks/[id]]", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
