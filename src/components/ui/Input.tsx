import '../../styles/theme.css'
import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  variant?: 'default' | 'glass'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    label, 
    error, 
    icon, 
    variant = 'default',
    type = 'text',
    ...props 
  }, ref) => {
    const baseClasses = `
      w-full px-4 py-3 text-text-primary placeholder-text-tertiary
      border rounded-xl transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `

    const variantClasses = {
      default: `
        bg-input-bg border-card-border
        focus:border-brand-500 focus:ring-brand-500/20
        hover:border-card-border
      `,
      glass: `
        glass border-card-border
        focus:border-brand-500 focus:ring-brand-500/20
      `
    }

    const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-text-secondary ml-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`
              ${baseClasses} 
              ${variantClasses[variant]} 
              ${errorClasses}
              ${icon ? 'pl-10' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-400 mt-1 ml-1">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input } 