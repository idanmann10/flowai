import React from 'react';

interface ProgressBarProps {
  value: number;
  label?: string;
  sublabel?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  sublabel,
  height = 8
}) => {
  // Ensure value is between 0 and 100
  const normalizedValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className="w-full">
      {/* Labels */}
      {(label || sublabel) && (
        <div className="flex justify-between items-baseline mb-2">
          {label && (
            <div className="text-sm font-medium text-text-secondary">
              {label}
            </div>
          )}
          {sublabel && (
            <div className="text-xs text-text-tertiary">
              {sublabel}
            </div>
          )}
        </div>
      )}
      
      {/* Progress bar */}
      <div 
        className="w-full rounded-full bg-white/10 overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
          style={{ 
            width: `${normalizedValue}%`,
            transition: 'width 500ms ease'
          }}
        />
      </div>
      
      {/* Percentage */}
      <div className="mt-1 text-right text-sm font-medium text-text-secondary">
        {normalizedValue}%
      </div>
    </div>
  );
}; 