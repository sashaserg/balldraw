import { useRef, useEffect, useState } from 'react'
import { useToolStore, DEFAULT_CAMERA_DISTANCE, MAX_BRUSH_SIZE } from '../stores/toolStore'
import { TEXTURE_SCALE_FACTOR } from './PaintableSphere'

interface BrushCursorProps {
  containerRef: React.RefObject<HTMLDivElement>
}

/**
 * Renders a circle cursor that shows the current brush size.
 * Uses direct DOM manipulation for smooth performance.
 * Scales based on camera zoom level.
 */
export function BrushCursor({ containerRef }: BrushCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const { brushSize, brushColor, tool, cameraDistance } = useToolStore()
  
  // Scale cursor size based on camera distance with size-dependent adjustment
  // Apply texture scale factor to show accurate painting size on lower resolution texture
  // Larger brushes get more aggressive compensation (scale down more)
  const zoomScale = DEFAULT_CAMERA_DISTANCE / cameraDistance
  const sizeCompensation = 1 - (brushSize / MAX_BRUSH_SIZE) * 0.3
  const scaledSize = brushSize * TEXTURE_SCALE_FACTOR * zoomScale * sizeCompensation
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const cursor = cursorRef.current
      if (!cursor) return
      
      // Update position directly via transform (GPU accelerated)
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
      setIsVisible(true)
    }
    
    const handleMouseLeave = () => {
      setIsVisible(false)
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      // Only track left/right mouse buttons (not middle)
      if (e.button === 0 || e.button === 2) {
        setIsDrawing(true)
      }
    }
    
    const handleMouseUp = () => {
      setIsDrawing(false)
    }
    
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef])
  
  // Determine color based on tool
  const cursorColor = tool === 'erase' ? '#ffffff' : brushColor
  
  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: scaledSize,
        height: scaledSize,
        marginLeft: -scaledSize / 2,
        marginTop: -scaledSize / 2,
        borderRadius: '50%',
        border: `2px solid ${cursorColor}`,
        backgroundColor: isDrawing ? `${cursorColor}33` : 'transparent',
        opacity: isVisible ? (isDrawing ? 1 : 0.6) : 0,
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'opacity 0.1s, width 0.1s, height 0.1s, margin 0.1s, background-color 0.1s',
        willChange: 'transform',
        boxSizing: 'border-box',
      }}
    />
  )
}
