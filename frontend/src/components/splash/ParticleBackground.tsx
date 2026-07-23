import { memo, useEffect, useRef } from 'react'

import { cn } from '@/utils/cn'

/** Matches the official logo matte navy/space field (dominant #010208 family). */
const SPLASH_BASE = '#010208'
const SPLASH_GRADIENT_MID = '#02101c'
const SPLASH_GRADIENT_EDGE = '#010208'
const SPLASH_CENTER = '#020a14'

interface ParticleBackgroundProps {
  className?: string
  disabled?: boolean
}

interface Particle {
  x: number
  y: number
  r: number
  opacity: number
  speed: number
  drift: number
  twinklePhase: number
}

function createParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.35 + Math.random() * 0.9,
    opacity: 0.08 + Math.random() * 0.2,
    speed: 0.012 + Math.random() * 0.028,
    drift: (Math.random() - 0.5) * 0.1,
    twinklePhase: Math.random() * Math.PI * 2,
  }))
}

function SplashBackdrop({ className }: { className?: string }) {
  return (
    <>
      <div className="absolute inset-0" style={{ backgroundColor: SPLASH_BASE }} />
      <div
        className={cn('absolute inset-0', className)}
        style={{
          background: `radial-gradient(ellipse 95% 85% at 50% 42%, ${SPLASH_CENTER} 0%, ${SPLASH_GRADIENT_MID} 42%, ${SPLASH_BASE} 78%, ${SPLASH_GRADIENT_EDGE} 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_40%,rgba(48,42,105,0.12),transparent_70%)]" />
    </>
  )
}

export const ParticleBackground = memo(function ParticleBackground({
  className,
  disabled,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (disabled) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let frame = 0
    let particles: Particle[] = []
    let time = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = createParticles(Math.floor((width * height) / 22_000), width, height)
    }

    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      time += 0.016
      const { width, height } = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.y -= p.speed
        p.x += p.drift
        if (p.y < -4) {
          p.y = height + 4
          p.x = Math.random() * width
        }
        if (p.x < -4) p.x = width + 4
        if (p.x > width + 4) p.x = -4

        const twinkle = 0.55 + 0.45 * Math.sin(time * 0.9 + p.twinklePhase)
        const alpha = p.opacity * twinkle

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(170, 190, 255, ${alpha})`
        ctx.fill()
      }

      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(frame)
    }
  }, [disabled])

  if (disabled) {
    return (
      <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
        <SplashBackdrop />
      </div>
    )
  }

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <SplashBackdrop />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-55" />
    </div>
  )
})
