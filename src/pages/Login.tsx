import '../styles/theme.css'
import { useState } from 'react'
import { useAuth } from '../stores/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import logoUrl from '../assets/flow-ai-logo.png'

const Login = () => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (error) {
      console.error('Login error:', error)
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Simple Background */}
      <div className="login-background" />
      
      {/* Minimal Particles - only 5 instead of 20 */}
      <div className="login-particles">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              width: Math.random() * 3 + 2 + 'px',
              height: Math.random() * 3 + 2 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDelay: Math.random() * 4 + 's'
            }}
          />
        ))}
      </div>

      {/* Main Login Card */}
      <div className="login-card">
        {/* Logo and Branding */}
        <div className="login-logo-section" style={{ marginBottom: '20px' }}>
          <div className="login-logo" style={{ 
            background: 'transparent', 
            boxShadow: 'none',
            width: 'auto',
            height: 'auto',
            padding: '0',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <img src={logoUrl} alt="Flow AI" style={{ width: '180px', height: '108px', objectFit: 'contain' }} />
          </div>
          <h1 className="login-brand-title" style={{ display: 'none' }}>
            
          </h1>
          <p className="login-brand-subtitle" style={{ display: 'none' }}>
            
          </p>
        </div>

        {/* Welcome Header */}
        <div className="login-welcome" style={{ marginBottom: '25px' }}>
          <h2 className="login-welcome-title">
            Welcome Back! 👋
          </h2>
          <p className="login-welcome-subtitle">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-inputs">
            <div className="login-input-group">
              <label className="login-input-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="login-input"
              />
            </div>

            <div className="login-input-group">
              <label className="login-input-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="login-input"
              />
            </div>
          </div>

          {error && (
            <div className="login-error">
              <p className="login-error-text">
                ⚠️ {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-submit-button"
          >
            <span className="login-submit-button-content">
              {loading ? '🔄 Signing in...' : '🚀 Sign In'}
            </span>
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="login-footer-text">
            Need help? <span className="login-footer-link">Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login 