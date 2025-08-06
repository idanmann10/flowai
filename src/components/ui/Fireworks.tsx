import React, { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface FireworksProps {
  isActive: boolean
  duration?: number
  intensity?: 'low' | 'medium' | 'high'
  colors?: string[]
  className?: string
  style?: React.CSSProperties
}

const Fireworks: React.FC<FireworksProps> = ({
  isActive,
  duration = 3000,
  intensity = 'medium',
  colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()

  const intensityMap = {
    low: { count: 15, spread: 30, startVelocity: 25 },
    medium: { count: 25, spread: 45, startVelocity: 30 },
    high: { count: 40, spread: 60, startVelocity: 35 }
  }

  const currentIntensity = intensityMap[intensity]

  const createFirework = (x: number, y: number) => {
    const end = Date.now() + duration

    const firework = () => {
      confetti({
        particleCount: currentIntensity.count,
        angle: 60,
        spread: currentIntensity.spread,
        origin: { x: x / window.innerWidth, y: y / window.innerHeight },
        startVelocity: currentIntensity.startVelocity,
        colors: colors,
        shapes: ['star'],
        gravity: 0.8,
        ticks: 200,
        zIndex: 9999,
        disableForReducedMotion: true
      })

      confetti({
        particleCount: currentIntensity.count * 0.6,
        angle: 120,
        spread: currentIntensity.spread * 0.8,
        origin: { x: x / window.innerWidth, y: y / window.innerHeight },
        startVelocity: currentIntensity.startVelocity * 0.8,
        colors: colors,
        shapes: ['circle'],
        gravity: 0.9,
        ticks: 150,
        zIndex: 9999,
        disableForReducedMotion: true
      })

      if (Date.now() < end) {
        animationRef.current = requestAnimationFrame(firework)
      }
    }

    firework()
  }

  const createMultipleFireworks = () => {
    const positions = [
      { x: window.innerWidth * 0.2, y: window.innerHeight * 0.3 },
      { x: window.innerWidth * 0.8, y: window.innerHeight * 0.4 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.2 },
      { x: window.innerWidth * 0.3, y: window.innerHeight * 0.5 },
      { x: window.innerWidth * 0.7, y: window.innerHeight * 0.6 }
    ]

    positions.forEach((pos, index) => {
      setTimeout(() => {
        createFirework(pos.x, pos.y)
      }, index * 200)
    })
  }

  const createContinuousFireworks = () => {
    const endTime = Date.now() + duration
    startTimeRef.current = Date.now()

    const fireworkLoop = () => {
      if (Date.now() < endTime) {
        // Create firework at random position
        const x = Math.random() * window.innerWidth
        const y = Math.random() * (window.innerHeight * 0.7) + window.innerHeight * 0.1

        confetti({
          particleCount: currentIntensity.count,
          angle: 90,
          spread: currentIntensity.spread,
          origin: { x: x / window.innerWidth, y: y / window.innerHeight },
          startVelocity: currentIntensity.startVelocity,
          colors: colors,
          shapes: ['star', 'circle'],
          gravity: 0.8,
          ticks: 200,
          zIndex: 9999,
          disableForReducedMotion: true
        })

        // Schedule next firework
        const nextDelay = Math.random() * 600 + 400 // 400-1000ms between fireworks
        setTimeout(fireworkLoop, nextDelay)
      }
    }

    fireworkLoop()
  }

  useEffect(() => {
    if (isActive && canvasRef.current) {
      // Clear any existing animations
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      // Start fireworks based on intensity
      if (intensity === 'high') {
        createContinuousFireworks()
      } else {
        createMultipleFireworks()
      }

      // Cleanup function
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }
  }, [isActive, intensity, duration, colors])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

export default Fireworks 