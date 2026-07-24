// src/components/ui/Sparkline.tsx
"use client";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = "#34D399",
}: Props) {
  if (!data.length) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const pts = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const id = `spark-${Math.round(min * 1000)}-${data.length}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
      <polygon
        fill={`url(#${id})`}
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
      />
    </svg>
  );
}
