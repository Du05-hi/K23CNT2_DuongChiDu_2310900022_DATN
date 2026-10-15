import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface ProductivityMetric {
  metric: string;
  score: number;
  fullMark: number;
}

export interface RadarProductivityChartProps {
  data?: ProductivityMetric[];
  height?: number;
  title?: string;
  description?: string;
}

const defaultData: ProductivityMetric[] = [
  { metric: 'Tasks (Khối lượng)', score: 88, fullMark: 100 },
  { metric: 'Chất lượng', score: 92, fullMark: 100 },
  { metric: 'Đúng hạn (Deadline)', score: 84, fullMark: 100 },
  { metric: 'Teamwork', score: 90, fullMark: 100 },
  { metric: 'Sáng tạo & Đề xuất', score: 78, fullMark: 100 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl text-xs space-y-1">
        <p className="font-semibold text-slate-800 dark:text-slate-100">
          {item.payload.metric}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">Điểm đánh giá:</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            {item.value} / {item.payload.fullMark}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const RadarProductivityChart: React.FC<RadarProductivityChartProps> = ({
  data = defaultData,
  height = 320,
  title = 'Đánh giá năng suất tổng hợp',
  description = 'Phân tích đa chiều theo 5 tiêu chí KPI nhân sự',
}) => {
  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-800" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              stroke="#cbd5e1"
              className="dark:stroke-slate-800"
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Điểm KPI"
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.45}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RadarProductivityChart;
