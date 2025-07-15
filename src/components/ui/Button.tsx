import '../../styles/theme.css'
import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled = false,
    children, 
    ...props 
  }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2 
      font-medium rounded-xl transition-all duration-200 
      focus:outline-none focus:ring-2 focus:ring-offset-2 
      disabled:opacity-50 disabled:cursor-not-allowed
      relative overflow-hidden
    `

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg'
    }

    const variantClasses = {
      primary: `
        bg-brand-500 text-white border border-brand-500
        hover:bg-brand-600 hover:border-brand-600
        focus:ring-brand-500 shadow-lg shadow-brand-500/25
        transform hover:scale-105
      `,
      secondary: `
        bg-accent-500 text-white border border-accent-500
        hover:bg-accent-600 hover:border-accent-600
        focus:ring-accent-500 shadow-lg shadow-accent-500/25
        transform hover:scale-105
      `,
      outline: `
        bg-transparent text-brand-500 border border-brand-500
        hover:bg-brand-500 hover:text-white
        focus:ring-brand-500
      `,
      ghost: `
        bg-transparent text-text-primary border border-transparent
        hover:bg-white/10
        focus:ring-white/20
      `,
      danger: `
        bg-red-500 text-white border border-red-500
        hover:bg-red-600 hover:border-red-600
        focus:ring-red-500 shadow-lg shadow-red-500/25
        transform hover:scale-105
      `
    }

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="loading-spinner mr-2" style={{ width: '16px', height: '16px' }} />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button } 