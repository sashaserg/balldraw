import { useRef, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { PaintableSphere } from './PaintableSphere'
import { useToolStore } from '../stores/toolStore'

export function Scene() {
  const controlsRef = useRef(null)
  const { gl } = useThree()
  const toggleTool = useToolStore((state) => state.toggleTool)

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
      
      {/* The paintable sphere */}
      <PaintableSphere />
      
      {/* Orbit controls - right mouse button only for rotation */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        mouseButtons={{
          LEFT: undefined as unknown as THREE.MOUSE, // Disable left-click rotation (we use it for painting)
          MIDDLE: undefined as unknown as THREE.MOUSE, // Disable middle-click (we use it for tool toggle)
          RIGHT: THREE.MOUSE.ROTATE, // Right-click for rotation
        }}
        minDistance={2}
        maxDistance={6}
      />
    </>
  )
}
