import React, { useEffect, useState } from 'react'

interface AnimatedStarsProps {
  stars: number
  maxStars?: number
  size?: 'small' | 'medium' | 'large'
  animated?: boolean
  className?: string
  style?: React.CSSProperties
}

const AnimatedStars: React.FC<AnimatedStarsProps> = ({
  stars,
  maxStars = 3,
  size = 'medium',
  animated = true,
  className,
  style
}) => {
  const [animatedStars, setAnimatedStars] = useState<boolean[]>([])
  
  const sizeMap = {
    small: {
      fontSize: '16px',
      gap: '4px'
    },
    medium: {
      fontSize: '24px',
      gap: '6px'
    },
    large: {
      fontSize: '32px',
      gap: '8px'
    }
  }
  
  const currentSize = sizeMap[size]
  
  useEffect(() => {
    if (animated) {
      // Initialize all stars as not animated
      setAnimatedStars(new Array(maxStars).fill(false))
      
      // Animate stars one by one with delay
      const animateStars = () => {
        for (let i = 0; i < Math.min(stars, maxStars); i++) {
          setTimeout(() => {
            setAnimatedStars(prev => {
              const newStars = [...prev]
              newStars[i] = true
              return newStars
            })
          }, i * 200) // 200ms delay between each star
        }
      }
      
      // Start animation after a short delay
      setTimeout(animateStars, 100)
    } else {
      // No animation, just set all stars
      setAnimatedStars(new Array(maxStars).fill(true))
    }
  }, [stars, maxStars, animated])
  
  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        gap: currentSize.gap,
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const isActive = index < stars
        const isAnimated = animatedStars[index]
        
        return (
          <div
            key={index}
            style={{
              fontSize: currentSize.fontSize,
              transition: 'all 0.3s ease',
              transform: isActive && isAnimated ? 'scale(1.1)' : 'scale(1)',
              color: isActive ? '#FFD700' : '#666666',
              opacity: isActive ? 1 : 0.4,
              cursor: 'default'
            }}
          >
            {isActive ? '⭐' : '☆'}
          </div>
        )
      })}
    </div>
  )
}

export default AnimatedStars 