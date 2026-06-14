import { getProctoringAttempts } from "@/lib/proctor-queries"
import ProctoringRow from "./ProctoringRow"

interface Props {
  assessmentId: number
  userId: number
}

export default async function ProctoringTab({ assessmentId, userId }: Props) {
  const attempts = await getProctoringAttempts(assessmentId, userId)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
          Proctoring
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-slate-400">No proctoring records found for this assessment.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Flags
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Consent At
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attempts.map((row) => (
              <ProctoringRow key={row.attemptId} row={row} userId={userId} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
