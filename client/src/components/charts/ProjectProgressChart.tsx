import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ProgressDataPoint {
  date: string;
  completed: number;
  planned: number;
  inProgress?: number;
}

export interface ProjectProgressChartProps {
  data?: ProgressDataPoint[];
  height?: number;
  title?: string;
  description?: string;
}

const defaultData: ProgressDataPoint[] = [
  { date: 'Tuần 1', planned: 12, completed: 8, inProgress: 4 },
  { date: 'Tuần 2', planned: 24, completed: 19, inProgress: 6 },
  { date: 'Tuần 3', planned: 36, completed: 31, inProgress: 8 },
  { date: 'Tuần 4', planned: 50, completed: 44, inProgress: 9 },
  { date: 'Tuần 5', planned: 68, completed: 62, inProgress: 11 },
  { date: 'Tuần 6', planned: 82, completed: 78, inProgress: 8 },
  { date: 'Tuần 7', planned: 95, completed: 92, inProgress: 4 },
  { date: 'Tuần 8', planned: 100, completed: 98, inProgress: 2 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl text-xs space-y-1.5">
        <p className="font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1">
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {entry.value} {entry.dataKey === 'progress' ? '%' : 'tasks'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ProjectProgressChart: React.FC<ProjectProgressChartProps> = ({
  data = defaultData,
  height = 320,
  title = 'Tiến độ hoàn thành dự án',
  description = 'So sánh số lượng task dự kiến và thực tế hoàn thành',
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
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              className="dark:stroke-slate-800"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="planned"
              name="Kế hoạch"
              stroke="#6366f1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPlanned)"
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Đã hoàn thành"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorCompleted)"
              activeDot={{ r: 6 }}
            />
            <Area
              type="monotone"
              dataKey="inProgress"
              name="Đang thực hiện"
              stroke="#f59e0b"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#colorInProgress)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProjectProgressChart;
