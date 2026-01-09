/**
 * TreeOrnamentBall Component
 * 
 * Renders a paintable sphere as a Christmas tree ornament.
 * Uses a lower resolution texture for performance since ornaments are small.
 */

import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'

// Lower resolution for ornaments (256px vs 4K main canvas)
// This is sufficient since ornaments appear small on the tree
const ORNAMENT_TEXTURE_SIZE = 256

interface TreeOrnamentBallProps {
  /** Base64 thumbnail image from project */
  thumbnail: string
  /** Scale of the ornament */
  scale?: number
}

export function TreeOrnamentBall({ thumbnail, scale = 1 }: TreeOrnamentBallProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Create texture from thumbnail
  const texture = useMemo(() => {
    // Create a canvas to draw the thumbnail
    const canvas = document.createElement('canvas')
    canvas.width = ORNAMENT_TEXTURE_SIZE
    canvas.height = ORNAMENT_TEXTURE_SIZE
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return null
    
    // Fill with default color first
    ctx.fillStyle = '#a0a0a0'
    ctx.fillRect(0, 0, ORNAMENT_TEXTURE_SIZE, ORNAMENT_TEXTURE_SIZE)
    
    // Load and draw the thumbnail image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    
    img.onload = () => {
      // Draw the thumbnail onto the canvas
      // The thumbnail is a square snapshot of the ball
      ctx.drawImage(img, 0, 0, ORNAMENT_TEXTURE_SIZE, ORNAMENT_TEXTURE_SIZE)
      tex.needsUpdate = true
    }
    
    img.src = thumbnail
    
    return tex
  }, [thumbnail])
  
  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])
  
  if (!texture) return null
  
  return (
    <mesh ref={meshRef} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial 
        map={texture}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}
