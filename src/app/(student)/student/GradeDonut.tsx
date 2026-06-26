const GRADE_ORDER = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
];

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#107c10";
  if (grade.startsWith("B")) return "#002388";
  if (grade.startsWith("C")) return "#ca5010";
  if (grade.startsWith("D")) return "#8764b8";
  return "#d13438";
}

const R = 34;
const CIRC = 2 * Math.PI * R;

interface GradeDonutProps {
  distribution: Record<string, number>;
  total: number;
}

export default function GradeDonut({ distribution, total }: GradeDonutProps) {
  if (total === 0) {
    return (
      <p className="text-[13px] text-muted-foreground py-4 text-center">
        No results yet
      </p>
    );
  }

  const entries = [
    ...GRADE_ORDER.filter((g: any) => (distribution[g] ?? 0) > 0).map((g: any) => ({
      grade: g,
      count: distribution[g],
      color: gradeColor(g),
    })),
    ...Object.keys(distribution)
      .filter((g: any) => !GRADE_ORDER.includes(g) && distribution[g] > 0)
      .map((g: any) => ({ grade: g, count: distribution[g], color: gradeColor(g) })),
  ];

  let cumulative = 0;
  const segments = entries.map((e: any) => {
    const len = (e.count / total) * CIRC;
    const seg = { ...e, len, offset: cumulative };
    cumulative += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-5">
      {/* Donut */}
      <div className="relative flex-shrink-0 w-[120px] h-[120px]">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ transform: "rotate(-90deg)" }}
        >
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={13}
              strokeDasharray={`${s.len} ${CIRC - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[17px] font-bold text-[#1e293b] leading-none">
            {total}
          </span>
          <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            taken
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {segments.map((s: any) => (
          <div key={s.grade} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[11px] font-medium text-[#1e293b]">
                {s.grade}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>{s.count}</span>
              <span className="text-[10px]">
                ({Math.round((s.count / total) * 100)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
