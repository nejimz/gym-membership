'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts';

export function LineMetricChart({
  data,
  dataKey,
  color = '#2f7a4e',
  name,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  name?: string;
}) {
  const label = name ?? dataKey;
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={`${label} trend chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={40} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendanceBarChart({
  data,
  ariaLabel = 'Attendance by day chart',
}: {
  data: { date: string; count: number }[];
  ariaLabel?: string;
}) {
  const mapped = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  const interval = mapped.length > 45 ? 6 : mapped.length > 20 ? 2 : 0;
  return (
    <div className="h-64 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={mapped}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={interval} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#2f7a4e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LabeledBarChart({
  data,
  ariaLabel,
  name = 'Count',
  color = '#2f7a4e',
  interval = 0,
}: {
  data: { label: string; count: number }[];
  ariaLabel: string;
  name?: string;
  color?: string;
  interval?: number;
}) {
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={interval} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" name={name} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComposedMetricChart({
  data,
}: {
  data: {
    label: string;
    visitCount: number;
    avgWeightKg: number | null;
  }[];
}) {
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label="Workouts versus weight chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="visits"
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            width={32}
          />
          <YAxis
            yAxisId="weight"
            orientation="right"
            tick={{ fontSize: 12 }}
            width={40}
          />
          <Tooltip />
          <Bar
            yAxisId="visits"
            dataKey="visitCount"
            name="Visits"
            fill="#2f7a4e"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="avgWeightKg"
            name="Avg weight (kg)"
            stroke="#c45c26"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
