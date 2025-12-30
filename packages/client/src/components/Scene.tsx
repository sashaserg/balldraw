import { useRef, useEffect, useCallback, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { PaintableSphere } from './PaintableSphere'
import { useToolStore } from '../stores/toolStore'
import { useProjectStore } from '../stores/projectStore'
import { useArcballRotation } from '../hooks/useArcballRotation'

export function Scene() {
  const controlsRef = useRef(null)
  const { gl } = useThree()
  const toggleTool = useToolStore((state) => state.toggleTool)
  const rotationMode = useToolStore((state) => state.rotationMode)
  const setCaptureSnapshot = useProjectStore((state) => state.setCaptureSnapshot)
  
  // Ball rotation state (quaternion for smooth rotation)
  const [ballRotation, setBallRotation] = useState(() => new THREE.Quaternion())
  
  // Register snapshot capture function
  useEffect(() => {
    const captureSnapshot = () => {
      try {
        // Force a render to ensure we have the latest state
        return gl.domElement.toDataURL('image/png')
      } catch (error) {
        console.error('[Scene] Failed to capture snapshot:', error)
        return null
      }
    }
    
    setCaptureSnapshot(captureSnapshot)
    
    return () => {
      setCaptureSnapshot(null)
    }
  }, [gl, setCaptureSnapshot])

  // Use arcball rotation for natural "grab and spin" feel
  useArcballRotation({
    enabled: rotationMode === 'ball',
    canvas: gl.domElement,
    onRotate: setBallRotation,
    mouseButton: 2, // Right mouse button
    radius: 0.6, // Virtual sphere covers 60% of viewport for tighter control
  })

  // Handle middle-click to toggle tool
  const handleMiddleClick = useCallback((e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      toggleTool()
    }
  }, [toggleTool])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('mousedown', handleMiddleClick)
    // Prevent context menu on middle click
    canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault()
    })
    return () => {
      canvas.removeEventListener('mousedown', handleMiddleClick)
    }
  }, [gl, handleMiddleClick])

  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.4} />
      
      {/* Main directional light */}
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      
      {/* Subtle fill light from opposite side */}
      <directionalLight position={[-3, -2, -3]} intensity={0.3} />
      
      {/* The paintable sphere with rotation */}
      <PaintableSphere rotation={ballRotation} />
      
      {/* Orbit controls - only enabled in camera rotation mode */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enableRotate={rotationMode === 'camera'}
        mouseButtons={{
          LEFT: undefined as unknown as THREE.MOUSE, // Disable left-click rotation (we use it for painting)
          MIDDLE: undefined as unknown as THREE.MOUSE, // Disable middle-click (we use it for tool toggle)
          RIGHT: rotationMode === 'camera' ? THREE.MOUSE.ROTATE : undefined as unknown as THREE.MOUSE,
        }}
        minDistance={2}
        maxDistance={6}
      />
    </>
  )
}
