import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import BankDetailClient from "./BankDetailClient"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import LoadingLogo from "@/components/ui/LoadingLogo"

async function BankDetailData({ id }: { id: string }) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/")

  const bankId = parseInt(id)
  if (isNaN(bankId)) notFound()

  const bank = await prisma.questionBank.findUnique({
    where: { id: bankId },
    select: { lecturerId: true },
  })

  // Return 404 — don't reveal whether the bank exists at all
  if (!bank || bank.lecturerId !== user.id) notFound()

  return <BankDetailClient bankId={bankId} />
}

export default async function BankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
      <Suspense
        fallback={
          <div className="relative">
            <TableSkeleton />
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <div className="scale-75 opacity-80">
                <LoadingLogo />
              </div>
            </div>
          </div>
        }
      >
        <BankDetailData id={id} />
      </Suspense>
    </div>
  )
}
