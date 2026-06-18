"use client";

type Point = { label: string; score: number; date: string };

export default function GradesTrendChart({ points }: { points: Point[] }) {
  if (points.length < 2) return null;

  const W = 600;
  const H = 120;
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxScore = 100;
  const minScore = Math.max(0, Math.min(...points.map((p) => p.score)) - 10);

  function x(i: number) {
    return PAD.left + (i / (points.length - 1)) * chartW;
  }
  function y(score: number) {
    return PAD.top + chartH - ((score - minScore) / (maxScore - minScore)) * chartH;
  }

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(" ");

  const areaD =
    pathD +
    ` L ${x(points.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  const yGridLines = [0, 25, 50, 75, 100].filter((v) => v >= minScore);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 300, height: H }}
        role="img"
        aria-label="Score trend chart"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#002388" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#002388" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yGridLines.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={y(v)}
              x2={PAD.left + chartW} y2={y(v)}
              stroke="#edebe9" strokeWidth="1"
            />
            <text
              x={PAD.left - 6} y={y(v) + 4}
              fontSize="9" fill="#8a8886" textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}

        {/* 50% threshold */}
        <line
          x1={PAD.left} y1={y(50)}
          x2={PAD.left + chartW} y2={y(50)}
          stroke="#ca5010" strokeWidth="0.8" strokeDasharray="4,3"
        />

        {/* Area fill */}
        <path d={areaD} fill="url(#trend-fill)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#002388" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.score)} r="3.5" fill="white" stroke="#002388" strokeWidth="2" />
            {/* x-axis label */}
            <text
              x={x(i)} y={H - 4}
              fontSize="8" fill="#8a8886" textAnchor="middle"
            >
              {p.date}
            </text>
            {/* Score tooltip on top of point */}
            <text
              x={x(i)} y={y(p.score) - 7}
              fontSize="8.5" fill="#002388" fontWeight="600" textAnchor="middle"
            >
              {p.score}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
