import React from 'react';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel
}) => {
  // Ensure value is between 0 and 100
  const normalizedValue = Math.min(100, Math.max(0, value));
  
  // Calculate dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;
  
  // Center point
  const center = size / 2;
  
  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={size}
        height={size / 2}
        className="transform rotate-180"
        style={{ overflow: 'visible' }}
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth/2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${center}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <path
          d={`M ${strokeWidth/2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth/2} ${center}`}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition: 'stroke-dashoffset 500ms ease'
          }}
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-secondary)" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Labels */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-2 text-center">
        {label && (
          <div className="text-sm font-medium text-text-secondary mb-1">
            {label}
          </div>
        )}
        <div className="text-2xl font-semibold text-text-primary">
          {normalizedValue}%
        </div>
        {sublabel && (
          <div className="text-xs text-text-tertiary mt-1">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}; 