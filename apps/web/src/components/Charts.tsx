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
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`${dataKey} trend chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendanceBarChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const mapped = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Attendance by day chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={mapped}>
          <CartesianGrid strokeDasharray="3 3" stroke="#24332c22" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#2f7a4e" radius={[4, 4, 0, 0]} />
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
    <div className="h-64 w-full" role="img" aria-label="Workouts versus weight chart">
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
