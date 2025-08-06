import React, { useState } from 'react';

interface HourlyData { time: string; productivity: number; }
interface DailyData { day: string; productivity: number; sessions: number; }
interface WeeklyData { week: string; productivity: number; sessions: number; }

interface ProductivityBarChartData {
  daily: HourlyData[];
  weekly: DailyData[];
  monthly: WeeklyData[];
  custom?: (HourlyData[] | DailyData[] | WeeklyData[]);
}

interface ProductivityBarChartProps {
  data: ProductivityBarChartData;
  view: 'daily' | 'weekly' | 'monthly' | 'custom';
  selectedDate?: string;
  selectedWeek?: string;
  selectedMonth?: string;
  customStartDate?: string;
  customEndDate?: string;
  onDateChange?: (date: string) => void;
  onWeekChange?: (week: string) => void;
  onMonthChange?: (month: string) => void;
  onCustomRangeChange?: (start: string, end: string) => void;
}

const ProductivityBarChart: React.FC<ProductivityBarChartProps> = ({
  data,
  view,
  selectedDate,
  selectedWeek,
  selectedMonth,
  customStartDate,
  customEndDate,
  onDateChange,
  onWeekChange,
  onMonthChange,
  onCustomRangeChange,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Select data for the current view
  let chartData: any[] = [];
  if (view === 'daily') chartData = data.daily;
  else if (view === 'weekly') chartData = data.weekly;
  else if (view === 'monthly') chartData = data.monthly;
  else if (view === 'custom' && data.custom) chartData = data.custom;

  // Tooltip content
  const getTooltipContent = (item: any) => {
    if (view === 'daily') {
      return `${item.time}: ${item.productivity}%`;
    } else if (view === 'weekly') {
      return `${item.day}: ${item.productivity}% (${item.sessions} sessions)`;
    } else if (view === 'monthly') {
      return `${item.week}: ${item.productivity}% (${item.sessions} sessions)`;
    } else if (view === 'custom') {
      return `${item.day}: ${item.productivity}% (${item.sessions} sessions)`;
    } else {
      return `${item.time || item.day || item.week}: ${item.productivity}%`;
    }
  };

  // Get the appropriate label for each view
  const getLabel = (item: any) => {
    if (view === 'daily') {
      return item.time; // Hour labels like "09:00", "10:00"
    } else if (view === 'weekly') {
      return item.day; // Day labels like "Mon", "Tue"
    } else if (view === 'monthly') {
      return item.week; // Week labels like "Week 1", "Week 2"
    } else if (view === 'custom') {
      return item.day; // Day labels like "Jul 15", "Jul 16"
    } else {
      return item.time || item.day || item.week;
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', position: 'relative', background: 'linear-gradient(135deg, #23233b 0%, #18181b 100%)', borderRadius: 20, boxShadow: '0 4px 32px #0004', padding: 32 }}>
      {/* Controls are now handled by parent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          gap: 12,
          height: 240,
          padding: '0 18px',
          background: 'none',
          borderRadius: 16,
          position: 'relative',
          minHeight: 180,
        }}
      >
        {Array.isArray(chartData) && chartData.length > 0 ? (
          chartData.map((item: any, idx: number) => (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                minWidth: 18,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                style={{
                  width: '100%',
                  minWidth: 14,
                  height: `${Math.max(item.productivity * 2.1, 4)}px`,
                  background: hoveredIndex === idx
                    ? 'linear-gradient(135deg, var(--accent-purple), #a78bfa)'
                    : 'linear-gradient(135deg, #6d28d9, #a78bfa)',
                  borderRadius: 10,
                  boxShadow: hoveredIndex === idx ? '0 6px 24px #a78bfa55' : '0 2px 8px #0002',
                  transition: 'all 0.2s cubic-bezier(.4,2,.6,1)',
                  position: 'relative',
                  opacity: item.productivity === 0 ? 0.3 : 1,
                }}
              />
              {/* Tooltip */}
              {hoveredIndex === idx && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: `${Math.max(item.productivity * 2.1, 4) + 16}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#23233b',
                    color: 'var(--text-primary)',
                    padding: '10px 18px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px #0008',
                    zIndex: 10,
                  }}
                >
                  {getTooltipContent(item)}
                </div>
              )}
              <span
                style={{
                  fontSize: 12,
                  color: hoveredIndex === idx ? 'var(--accent-purple)' : 'var(--text-muted)',
                  marginTop: 8,
                  transform: 'rotate(-45deg)',
                  whiteSpace: 'nowrap',
                  fontWeight: hoveredIndex === idx ? 700 : 400,
                  letterSpacing: 0.5,
                }}
              >
                {getLabel(item)}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 16, margin: 'auto' }}>No data</div>
        )}
      </div>
    </div>
  );
};

export default ProductivityBarChart; 