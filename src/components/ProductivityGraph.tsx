import React from 'react';
import { HourlyProductivityData, HalfHourlyProductivityData } from '../utils/productivityHelpers';

// Accept both HourlyProductivityData and HalfHourlyProductivityData
interface ProductivityGraphProps {
  data: (HourlyProductivityData | HalfHourlyProductivityData)[];
  height?: number;
  className?: string;
}

export const ProductivityGraph: React.FC<ProductivityGraphProps> = ({ 
  data, 
  height = 200, 
  className = '' 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`productivity-graph-empty ${className}`} style={{ height }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-small)'
        }}>
          No productivity data available
        </div>
      </div>
    );
  }

  const maxProductivity = Math.max(...data.map(d => d.avgProductivity), 100);
  const chartHeight = height - 60; // Reserve space for labels

  const getBarColor = (productivity: number): string => {
    if (productivity >= 80) return 'var(--success-color)';
    if (productivity >= 60) return 'var(--accent-purple)';
    if (productivity >= 40) return 'var(--warning-color)';
    return 'var(--error-color)';
  };

  // Helper to get the label for each bar (hourLabel or interval)
  const getLabel = (d: any) => d.hourLabel || d.interval || '';

  return (
    <div className={`productivity-graph ${className}`}>
      <div style={{
        display: 'flex',
        alignItems: 'end',
        justifyContent: 'space-around',
        height: chartHeight,
        padding: '0 10px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-surface)'
      }}>
        {data.map((d, index) => {
          const barHeight = (d.avgProductivity / maxProductivity) * (chartHeight - 20);
          return (
            <div
              key={`bar-${getLabel(d)}-${index}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '40px',
                position: 'relative'
              }}
            >
              {/* Productivity percentage tooltip */}
              <div style={{
                position: 'absolute',
                bottom: barHeight + 25,
                fontSize: 'var(--font-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                whiteSpace: 'nowrap',
                zIndex: 10,
                opacity: 0,
                transition: 'opacity 0.2s ease'
              }}
              className="productivity-tooltip"
              >
                {d.avgProductivity}%
                <br />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {d.summaryCount} intervals
                </span>
              </div>
              {/* Bar */}
              <div
                style={{
                  width: '24px',
                  height: `${barHeight}px`,
                  backgroundColor: getBarColor(d.avgProductivity),
                  borderRadius: '2px 2px 0 0',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.previousElementSibling as HTMLElement;
                  if (tooltip) tooltip.style.opacity = '1';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const tooltip = e.currentTarget.previousElementSibling as HTMLElement;
                  if (tooltip) tooltip.style.opacity = '0';
                  e.currentTarget.style.opacity = '0.8';
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 10px',
        fontSize: 'var(--font-xs)',
        color: 'var(--text-secondary)'
      }}>
        {data.map((d, index) => (
          <div
            key={`label-${getLabel(d)}-${index}`}
            style={{
              minWidth: '40px',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)'
            }}
          >
            {getLabel(d)}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        marginTop: '12px',
        fontSize: 'var(--font-xs)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--success-color)',
            borderRadius: '2px'
          }} />
          <span>80%+</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--accent-purple)',
            borderRadius: '2px'
          }} />
          <span>60-79%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--warning-color)',
            borderRadius: '2px'
          }} />
          <span>40-59%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--error-color)',
            borderRadius: '2px'
          }} />
          <span>0-39%</span>
        </div>
      </div>
    </div>
  );
}; 