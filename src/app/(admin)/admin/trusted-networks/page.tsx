import { prisma } from "@/lib/prisma"
import TrustedNetworksClient from "./TrustedNetworksClient"

export const dynamic = "force-dynamic"

export default async function TrustedNetworksPage() {
  const networks = await prisma.trustedNetwork.findMany({ orderBy: { name: "asc" } })
  return <TrustedNetworksClient initialNetworks={networks} />
}
