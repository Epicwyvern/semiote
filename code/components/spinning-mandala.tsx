"use client"

import { useEffect, useRef } from "react"

export function SpinningMandala() {
  const mandalaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mandala = mandalaRef.current
    if (!mandala) return

    let rotation = 0
    const rotationSpeed = 0.03 // Adjust for faster/slower rotation

    const animate = () => {
      rotation += rotationSpeed
      if (mandala) {
        mandala.style.transform = `rotate(${rotation}deg)`
      }
      requestAnimationFrame(animate)
    }

    const animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div
      ref={mandalaRef}
      className="fixed z-10 pointer-events-none"
      style={{
        transformOrigin: "center center",
        transform: "rotate(0deg)", // Initial rotation
        width: "150vw",
        height: "150vh",
        bottom: "-75vh",
        right: "-75vw",
      }}
    >
      <img
        src="/mandala.png"
        alt="Decorative mandala"
        className="w-full h-full object-contain opacity-90"
      />
    </div>
  )
}
