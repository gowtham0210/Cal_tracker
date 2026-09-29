"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatDate } from "@/lib/date";

const axisProps = {
  tick: { fill: "var(--subtle)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-text">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tabular font-medium text-text">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Weight trend ---------------- */
export interface WeightPoint {
  date: string;
  weight: number;
  trend: number;
}

export function WeightChart({
  data,
  goal,
  unit,
  height = 260,
  showGoal = true,
}: {
  data: WeightPoint[];
  goal?: number;
  unit: string;
  height?: number;
  showGoal?: boolean;
}) {
  const values = data.flatMap((d) => [d.weight, d.trend]);
  if (showGoal && goal) values.push(goal);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const long = data.length > 45;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            {...axisProps}
            tickFormatter={(d) => formatDate(d, { month: "short", day: "numeric" })}
            minTickGap={long ? 48 : 28}
          />
          <YAxis {...axisProps} domain={[min, max]} tickCount={5} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--subtle)", strokeDasharray: "3 3" }}
            content={({ active, payload }: TooltipContentProps) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as WeightPoint;
              return (
                <TooltipCard
                  title={formatDate(p.date, { weekday: "short", month: "short", day: "numeric" })}
                  rows={[
                    { label: "Weigh-in", value: `${p.weight.toFixed(1)} ${unit}`, color: "var(--subtle)" },
                    { label: "Trend", value: `${p.trend.toFixed(1)} ${unit}`, color: "var(--brand)" },
                  ]}
                />
              );
            }}
          />
          {showGoal && goal && (
            <ReferenceLine
              y={goal}
              stroke="var(--brand)"
              strokeDasharray="6 4"
              strokeOpacity={0.6}
              label={{ value: `Goal ${goal.toFixed(1)}`, position: "insideBottomRight", fill: "var(--muted)", fontSize: 11 }}
            />
          )}
          <Area type="monotone" dataKey="trend" stroke="none" fill="url(#wfill)" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--subtle)"
            strokeOpacity={0.55}
            strokeWidth={1}
            dot={{ r: 2, fill: "var(--subtle)", strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Calories per day ---------------- */
export interface CaloriePoint {
  date: string;
  label: string;
  intake: number;
  net: number;
  burned: number;
}

export function CaloriesChart({ data, goal, height = 240 }: { data: CaloriePoint[]; goal: number; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickCount={5} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", radius: 6 }}
            content={({ active, payload }: TooltipContentProps) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as CaloriePoint;
              const diff = p.net - goal;
              return (
                <TooltipCard
                  title={formatDate(p.date, { weekday: "short", month: "short", day: "numeric" })}
                  rows={[
                    { label: "Net", value: `${p.net.toLocaleString()} kcal`, color: "var(--brand)" },
                    { label: "Eaten", value: `${p.intake.toLocaleString()} kcal` },
                    { label: "Burned", value: `${p.burned.toLocaleString()} kcal` },
                    { label: diff > 0 ? "Over goal" : "Under goal", value: `${Math.abs(diff).toLocaleString()} kcal` },
                  ]}
                />
              );
            }}
          />
          <ReferenceLine
            y={goal}
            stroke="var(--text)"
            strokeOpacity={0.45}
            strokeDasharray="6 4"
            label={{ value: "Goal", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }}
          />
          <Bar dataKey="net" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Generic single-series bar ---------------- */
export function SimpleBars({
  data,
  color,
  unit,
  goal,
  height = 200,
}: {
  data: { date: string; label: string; value: number }[];
  color: string;
  unit: string;
  goal?: number;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickCount={4} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", radius: 6 }}
            content={({ active, payload }: TooltipContentProps) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; value: number };
              return (
                <TooltipCard
                  title={formatDate(p.date, { weekday: "short", month: "short", day: "numeric" })}
                  rows={[{ label: unit, value: p.value.toLocaleString(), color }]}
                />
              );
            }}
          />
          {goal !== undefined && <ReferenceLine y={goal} stroke="var(--text)" strokeOpacity={0.45} strokeDasharray="6 4" />}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- Measurements (small multiples friendly single line) ---------------- */
export function LineMini({
  data,
  color,
  unit,
  height = 120,
}: {
  data: { date: string; value: number }[];
  color: string;
  unit: string;
  height?: number;
}) {
  const vals = data.map((d) => d.value);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[Math.min(...vals) - 1, Math.max(...vals) + 1]} />
          <Tooltip
            cursor={{ stroke: "var(--subtle)", strokeDasharray: "3 3" }}
            content={({ active, payload }: TooltipContentProps) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; value: number };
              return <TooltipCard title={formatDate(p.date)} rows={[{ label: "Value", value: `${p.value.toFixed(1)} ${unit}`, color }]} />;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, color = "var(--brand)", height = 44 }: { data: number[]; color?: string; height?: number }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={d} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin - 0.3", "dataMax + 0.3"]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
