import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

export interface KpiBarDataPoint {
  name: string;
  score: number;
  target?: number;
  tasksCount?: number;
}

export interface KpiBarChartProps {
  data?: KpiBarDataPoint[];
  targetScore?: number;
  height?: number;
  title?: string;
  description?: string;
}

const defaultData: KpiBarDataPoint[] = [
  { name: 'Nguyễn Văn A', score: 94, target: 85, tasksCount: 28 },
  { name: 'Trần Thị B', score: 88, target: 85, tasksCount: 24 },
  { name: 'Lê Hoàng C', score: 91, target: 85, tasksCount: 26 },
  { name: 'Phạm Minh D', score: 76, target: 85, tasksCount: 19 },
  { name: 'Hoàng Lan E', score: 85, target: 85, tasksCount: 22 },
  { name: 'Vũ Quốc F', score: 96, target: 85, tasksCount: 31 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const dataPoint: KpiBarDataPoint = item.payload;
    const isAboveTarget = dataPoint.target ? dataPoint.score >= dataPoint.target : true;

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xl text-xs space-y-2">
        <p className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
          {label}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Điểm KPI:</span>
          <span
            className={`font-bold ${
              isAboveTarget
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {dataPoint.score} / 100
          </span>
        </div>
        {dataPoint.target && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Mục tiêu:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {dataPoint.target} điểm
            </span>
          </div>
        )}
        {dataPoint.tasksCount !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Tasks hoàn thành:</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              {dataPoint.tasksCount} tasks
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const KpiBarChart: React.FC<KpiBarChartProps> = ({
  data = defaultData,
  targetScore = 85,
  height = 320,
  title = 'Xếp hạng hiệu suất nhân sự',
  description = 'So sánh điểm KPI các thành viên với điểm mục tiêu định kỳ',
}) => {
  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block w-3 h-0.5 bg-rose-500 border border-dashed border-rose-500" />
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Target ({targetScore}đ)
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="kpiBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              className="dark:stroke-slate-800"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 100]}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
            <ReferenceLine
              y={targetScore}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Mục tiêu (${targetScore})`,
                fill: '#ef4444',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10, fontSize: 12 }} />
            <Bar
              name="Điểm KPI"
              dataKey="score"
              fill="url(#kpiBarGradient)"
              radius={[8, 8, 0, 0]}
              maxBarSize={45}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KpiBarChart;
