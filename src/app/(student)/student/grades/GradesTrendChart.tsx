"use client";

import { useState } from "react";

type Point = { label: string; score: number; date: string };

function gradeColor(score: number): string {
  if (score >= 70) return "#107c10";
  if (score >= 50) return "#8a6d1c";
  return "#a4262c";
}

export default function GradesTrendChart({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  // Generous canvas — scales responsively but renders large.
  const W = 760;
  const H = 300;
  const PAD = { top: 28, right: 28, bottom: 46, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * chartW;
  const y = (score: number) => PAD.top + chartH - (score / 100) * chartH;

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(" ");
  const areaD =
    lineD +
    ` L ${x(points.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

  const gridLines = [0, 20, 40, 60, 80, 100];

  // Only label every Nth date when there are many points (avoid crowding).
  const step = points.length > 9 ? Math.ceil(points.length / 8) : 1;

  const avg = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length);
  const last = points[points.length - 1].score;
  const first = points[0].score;
  const delta = last - first;

  return (
    <div className="w-full">
      {/* Mini stat strip above the chart */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        <Stat label="Latest" value={`${last}%`} color={gradeColor(last)} />
        <Stat label="Average" value={`${avg}%`} color="#1e293b" />
        <Stat
          label="Trend"
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`}
          color={delta >= 0 ? "#107c10" : "#a4262c"}
        />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Score trend chart"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#002388" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#002388" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0055A4" />
            <stop offset="100%" stopColor="#002388" />
          </linearGradient>
        </defs>

        {/* Grid + y labels */}
        {gridLines.map((v: any) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={y(v)} x2={PAD.left + chartW} y2={y(v)}
              stroke="#eef0f3" strokeWidth="1"
            />
            <text x={PAD.left - 10} y={y(v) + 4} fontSize="11" fill="#94a3b8" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {/* 50% pass threshold */}
        <line
          x1={PAD.left} y1={y(50)} x2={PAD.left + chartW} y2={y(50)}
          stroke="#ca5010" strokeWidth="1" strokeDasharray="5,4"
        />
        <text x={PAD.left + chartW} y={y(50) - 6} fontSize="10" fill="#ca5010" textAnchor="end" fontWeight="600">
          Pass 50%
        </text>

        {/* Area + line */}
        <path d={areaD} fill="url(#trend-fill)" />
        <path
          d={lineD} fill="none" stroke="url(#trend-stroke)"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Hover guide */}
        {hover !== null && (
          <line
            x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + chartH}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3"
          />
        )}

        {/* X labels */}
        {points.map((p, i) =>
          i % step === 0 || i === points.length - 1 ? (
            <text key={`xl-${i}`} x={x(i)} y={H - 16} fontSize="10.5" fill="#94a3b8" textAnchor="middle">
              {p.date}
            </text>
          ) : null
        )}

        {/* Points */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const active = hover === i;
          return (
            <g key={i}>
              <circle
                cx={x(i)} cy={y(p.score)}
                r={active ? 6 : isLast ? 5 : 4}
                fill="white"
                stroke={gradeColor(p.score)}
                strokeWidth={active || isLast ? 3 : 2.5}
                style={{ transition: "r 0.12s ease" }}
              />
              {/* Always show the latest value */}
              {isLast && hover === null && (
                <text
                  x={x(i)} y={y(p.score) - 12}
                  fontSize="12" fontWeight="700" fill={gradeColor(p.score)} textAnchor="middle"
                >
                  {p.score}%
                </text>
              )}
              {/* Generous invisible hit area */}
              <rect
                x={x(i) - chartW / (points.length - 1) / 2}
                y={PAD.top}
                width={chartW / (points.length - 1)}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hover !== null && (() => {
          const p = points[hover];
          const tw = Math.max(96, p.label.length * 6.5);
          const tx = Math.min(Math.max(x(hover) - tw / 2, PAD.left), PAD.left + chartW - tw);
          const ty = Math.max(y(p.score) - 56, 6);
          return (
            <g>
              <rect x={tx} y={ty} width={tw} height={42} rx="6" fill="#1e293b" />
              <text x={tx + tw / 2} y={ty + 17} fontSize="11" fontWeight="700" fill="white" textAnchor="middle">
                {p.score}% · {p.label}
              </text>
              <text x={tx + tw / 2} y={ty + 32} fontSize="10" fill="#94a3b8" textAnchor="middle">
                {p.date}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="text-[20px] font-bold leading-none tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}
