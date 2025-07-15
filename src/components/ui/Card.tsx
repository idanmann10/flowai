import '../../styles/theme.css'
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick
}) => {
  return (
    <div
      className={`
        card p-6 transition-all duration-300
        hover:transform hover:translate-y-[-2px]
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  icon,
  title,
  subtitle,
  action
}) => {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="text-text-secondary mt-1">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold text-text-primary font-heading tracking-wide">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="ml-4">
          {action}
        </div>
      )}
    </div>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
}; 