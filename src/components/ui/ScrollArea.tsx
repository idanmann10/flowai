import React from 'react';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string | number;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className = '',
  maxHeight
}) => {
  return (
    <div
      className={`
        overflow-y-auto
        scrollbar-thin
        scrollbar-track-background-elevated
        scrollbar-thumb-white/20
        hover:scrollbar-thumb-white/30
        ${className}
      `}
      style={{
        maxHeight,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255, 255, 255, 0.2) rgba(43, 44, 48, 1)'
      }}
    >
      {children}
    </div>
  );
}; 