import { useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'

/**
 * Arcball rotation hook - provides natural "grab and spin" rotation for 3D objects.
 * 
 * The arcball algorithm:
 * 1. Maps 2D mouse coordinates to points on a virtual sphere
 * 2. Computes rotation from the initial grab point to current drag point
 * 3. The rotation axis is perpendicular to both points (cross product)
 * 4. The rotation angle is the arc between the two points
 * 
 * This creates the intuitive feeling of physically grabbing and spinning a ball.
 */

interface ArcballOptions {
  enabled: boolean
  canvas: HTMLCanvasElement | null
  onRotate: (quaternion: THREE.Quaternion) => void
  mouseButton?: number // 0=left, 1=middle, 2=right
  radius?: number // Virtual sphere radius (0-1, relative to viewport)
}

/**
 * Project a 2D screen point onto a virtual sphere for arcball rotation.
 * Points outside the sphere are projected to the edge.
 */
function projectToSphere(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  radius: number
): THREE.Vector3 {
  // Normalize to [-1, 1] range centered on viewport
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1) // Flip Y
  
  // Scale by inverse radius to get unit sphere coordinates
  const scaledX = x / radius
  const scaledY = y / radius
  
  const lengthSq = scaledX * scaledX + scaledY * scaledY
  
  if (lengthSq <= 1) {
    // Point is inside the sphere - compute Z from sphere equation
    const z = Math.sqrt(1 - lengthSq)
    return new THREE.Vector3(scaledX, scaledY, z).normalize()
  } else {
    // Point is outside sphere - project to nearest point on edge
    return new THREE.Vector3(scaledX, scaledY, 0).normalize()
  }
}

/**
 * Compute rotation quaternion from one sphere point to another.
 */
function computeRotation(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
  // Rotation axis is perpendicular to both vectors
  const axis = new THREE.Vector3().crossVectors(from, to)
  
  if (axis.lengthSq() < 0.0001) {
    // Vectors are parallel, no rotation needed
    return new THREE.Quaternion()
  }
  
  axis.normalize()
  
  // Rotation angle from dot product
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)
  const angle = Math.acos(dot)
  
  return new THREE.Quaternion().setFromAxisAngle(axis, angle)
}

export function useArcballRotation({
  enabled,
  canvas,
  onRotate,
  mouseButton = 2, // Right mouse button
  radius = 0.8, // Virtual sphere covers 80% of viewport
}: ArcballOptions) {
  const isDragging = useRef(false)
  const startPoint = useRef(new THREE.Vector3())
  const currentRotation = useRef(new THREE.Quaternion())
  const baseRotation = useRef(new THREE.Quaternion())
  
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!enabled || e.button !== mouseButton || !canvas) return
    
    isDragging.current = true
    const rect = canvas.getBoundingClientRect()
    startPoint.current = projectToSphere(e.clientX, e.clientY, rect, radius)
    baseRotation.current.copy(currentRotation.current)
    
    e.preventDefault()
  }, [enabled, mouseButton, canvas, radius])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !enabled || !canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const currentPoint = projectToSphere(e.clientX, e.clientY, rect, radius)
    
    // Compute rotation from start to current
    const deltaRotation = computeRotation(startPoint.current, currentPoint)
    
    // Apply delta rotation to base rotation
    const newRotation = new THREE.Quaternion()
    newRotation.multiplyQuaternions(deltaRotation, baseRotation.current)
    
    currentRotation.current.copy(newRotation)
    onRotate(newRotation)
  }, [enabled, canvas, radius, onRotate])
  
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === mouseButton) {
      isDragging.current = false
    }
  }, [mouseButton])
  
  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (enabled && mouseButton === 2) {
      e.preventDefault()
    }
  }, [enabled, mouseButton])
  
  useEffect(() => {
    if (!canvas) return
    
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    canvas.addEventListener('contextmenu', handleContextMenu)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [canvas, handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu])
  
  // Return function to reset rotation
  return {
    reset: () => {
      currentRotation.current.identity()
      baseRotation.current.identity()
      onRotate(new THREE.Quaternion())
    }
  }
}
