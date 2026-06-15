import { redirect } from "next/navigation"

export default async function AssessmentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/lecturer/assessments/${id}?tab=results`)
}
