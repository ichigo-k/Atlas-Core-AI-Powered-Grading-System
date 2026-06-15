"use client"

import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js"
import { Doughnut } from "react-chartjs-2"

ChartJS.register(ArcElement, Tooltip)

interface Props {
  typeCounts: { EXAM: number; QUIZ: number; ASSIGNMENT: number }
}

const TYPES = [
  { key: "EXAM",       label: "Exams",       color: "#002388" },
  { key: "QUIZ",       label: "Quizzes",     color: "#3a6fd8" },
  { key: "ASSIGNMENT", label: "Assignments", color: "#FFCC00" },
] as const

export default function DashboardCharts({ typeCounts }: Props) {
  const total = typeCounts.EXAM + typeCounts.QUIZ + typeCounts.ASSIGNMENT

  const data = {
    datasets: [{
      data: [typeCounts.EXAM, typeCounts.QUIZ, typeCounts.ASSIGNMENT],
      backgroundColor: TYPES.map((t) => t.color),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0
            return `  ${TYPES[ctx.dataIndex].label}: ${ctx.parsed} (${pct}%)`
          },
        },
      },
    },
  }

  return (
    <div className="rounded-sm border border-border bg-white p-5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-5">
        Assessment Breakdown
      </p>

      {total === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-slate-400">No assessments yet.</p>
        </div>
      ) : (
        <div className="flex items-center gap-8">
          {/* Doughnut */}
          <div className="relative h-36 w-36 shrink-0">
            <Doughnut data={data} options={options} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-semibold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-3 flex-1">
            {TYPES.map(({ key, label, color }) => {
              const count = typeCounts[key]
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-slate-700 flex-1">{label}</span>
                  <span className="text-sm font-medium text-slate-900">{count}</span>
                  <span className="text-xs text-slate-400 w-9 text-right">{pct}%</span>
                </div>
              )
            })}
            {/* divider + total row */}
            <div className="border-t border-slate-100 pt-2 flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0" />
              <span className="text-xs text-slate-400 flex-1">Total</span>
              <span className="text-sm font-medium text-slate-900">{total}</span>
              <span className="text-xs text-slate-400 w-9 text-right">100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
