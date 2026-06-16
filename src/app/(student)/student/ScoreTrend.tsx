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
  darkMode?: boolean;
}

export default function ScoreTrend({ results, average, darkMode = false }: ScoreTrendProps) {
  if (results.length === 0) {
    return (
      <p className={`text-[13px] py-4 text-center ${darkMode ? "text-slate-400" : "text-muted-foreground"}`}>
        No results yet
      </p>
    );
  }

  return (
    <div>
      {/* Average badge */}
      {average != null && (
        <div className={`mb-3 text-[11px] ${darkMode ? "text-slate-400" : "text-muted-foreground"}`}>
          Average:{" "}
          <span className={`font-bold ${darkMode ? "text-amber-400" : "text-primary"}`}>
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
                className={`w-full rounded-t-sm transition-all duration-350 ${isLast
                    ? darkMode
                      ? "bg-[#FFCC00] shadow-[0_0_12px_rgba(255,204,0,0.4)]"
                      : "bg-accent"
                    : darkMode
                      ? "bg-slate-800 hover:bg-slate-700"
                      : "bg-[#c7e0f4] hover:bg-[#0055A4]"
                  }`}
                style={{ height }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-2 mt-2">
        {results.map((r, i) => {
          const isLast = i === results.length - 1;
          return (
            <div
              key={i}
              className={`flex-1 text-center text-[9px] truncate font-semibold tracking-wide ${isLast
                  ? darkMode
                    ? "text-[#FFCC00] font-bold"
                    : "text-primary font-bold"
                  : darkMode
                    ? "text-slate-400"
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
