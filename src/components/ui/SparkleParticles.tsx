import React, { useEffect, useState } from 'react'

interface SparkleParticle {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  delay: number
  duration: number
}

interface SparkleParticlesProps {
  isActive: boolean
  count?: number
  className?: string
  style?: React.CSSProperties
}

const SparkleParticles: React.FC<SparkleParticlesProps> = ({
  isActive,
  count = 20,
  className,
  style
}) => {
  const [particles, setParticles] = useState<SparkleParticle[]>([])

  useEffect(() => {
    if (isActive) {
      const newParticles: SparkleParticle[] = []
      
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100, // Percentage across container
          y: Math.random() * 100, // Percentage down container
          size: Math.random() * 4 + 2, // 2-6px
          opacity: Math.random() * 0.8 + 0.2, // 0.2-1.0
          delay: Math.random() * 2, // 0-2s delay
          duration: Math.random() * 2 + 1 // 1-3s duration
        })
      }
      
      setParticles(newParticles)
    } else {
      setParticles([])
    }
  }, [isActive, count])

  if (!isActive) return null

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1,
        ...style
      }}
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: 'radial-gradient(circle, #FFD700 0%, #FFA500 50%, transparent 100%)',
            borderRadius: '50%',
            opacity: particle.opacity,
            animation: `sparkleFloat ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
            boxShadow: '0 0 8px #FFD700',
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
      
      <style>{`
        @keyframes sparkleFloat {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(90deg);
          }
          50% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
          }
          75% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(270deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0) rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default SparkleParticles 