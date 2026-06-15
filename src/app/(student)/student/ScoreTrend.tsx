type TrendBar = {
  label: string;     // truncated, shown below bar
  fullLabel: string; // full title for tooltip
  course: string;    // course code for tooltip
  score: number;     // 0-100
  grade: string;
};

interface ScoreTrendProps {
  results: TrendBar[];
  average: number | null;
}

export default function ScoreTrend({ results, average }: ScoreTrendProps) {
  if (results.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground py-4 text-center">
        No results yet
      </p>
    );
  }

  return (
    <div>
      {/* Average badge */}
      {average != null && (
        <div className="mb-3 text-[11px] text-muted-foreground">
          Average:{" "}
          <span className="font-bold text-primary">
            {average.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Bars */}
      <div className="flex items-end gap-2 h-[72px]">
        {results.map((r, i) => {
          const isLast = i === results.length - 1;
          const height = `${Math.max(6, Math.min(r.score, 100))}%`;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full"
              title={`${r.fullLabel} · ${r.course}\n${r.score.toFixed(1)}% (${r.grade})`}
            >
              <div
                className={`w-full rounded-t-sm transition-colors ${
                  isLast
                    ? "bg-accent"
                    : "bg-[#c7e0f4] hover:bg-[#0055A4]"
                }`}
                style={{ height }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-2 mt-1.5">
        {results.map((r, i) => {
          const isLast = i === results.length - 1;
          return (
            <div
              key={i}
              className={`flex-1 text-center text-[9px] truncate ${
                isLast
                  ? "text-primary font-bold"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
