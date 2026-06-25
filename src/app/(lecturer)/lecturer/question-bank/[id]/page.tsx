import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Library, ChevronRight } from "lucide-react"
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
    select: { lecturerId: true, title: true },
  })

  if (!bank || bank.lecturerId !== user.id) notFound()

  return { bankId, title: bank.title }
}

export default async function BankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bankId, title } = await BankDetailData({ id })

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full flex flex-col">
      {/* Sticky command bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
        <Library size={11} />
        <Link href="/lecturer" className="hover:text-[#1e293b] transition-colors">Lecturer</Link>
        <ChevronRight size={11} />
        <Link href="/lecturer/question-bank" className="hover:text-[#1e293b] transition-colors">Question Bank</Link>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium truncate max-w-[200px]">{title}</span>
      </div>

      <Suspense
        fallback={
          <div className="px-4 py-5 md:px-6 lg:px-8 relative">
            <TableSkeleton />
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <div className="scale-75 opacity-80">
                <LoadingLogo />
              </div>
            </div>
          </div>
        }
      >
        <BankDetailClient bankId={bankId} />
      </Suspense>
    </div>
  )
}
