import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useToolStore } from '../stores/toolStore'

// Canvas texture resolution (higher = more detail, but more memory)
const TEXTURE_SIZE = 1024

// Base gray color for the sphere
const BASE_COLOR = '#a0a0a0'

export function PaintableSphere() {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  
  const isPainting = useRef(false)
  const lastUV = useRef<{ x: number; y: number } | null>(null)
  
  const { gl, camera, raycaster, pointer } = useThree()
  const { tool, brushColor, brushSize } = useToolStore()

  // Initialize the canvas texture
  useEffect(() => {
    const newCanvas = document.createElement('canvas')
    newCanvas.width = TEXTURE_SIZE
    newCanvas.height = TEXTURE_SIZE
    
    const newCtx = newCanvas.getContext('2d')
    if (!newCtx) return
    
    // Fill with base gray color
    newCtx.fillStyle = BASE_COLOR
    newCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    
    const newTexture = new THREE.CanvasTexture(newCanvas)
    newTexture.needsUpdate = true
    
    setCanvas(newCanvas)
    setCtx(newCtx)
    setTexture(newTexture)
    
    return () => {
      newTexture.dispose()
    }
  }, [])

  // Paint at UV coordinates
  const paintAtUV = useCallback((uv: { x: number; y: number }, fromUV?: { x: number; y: number }) => {
    if (!ctx || !texture) return
    
    const x = uv.x * TEXTURE_SIZE
    const y = (1 - uv.y) * TEXTURE_SIZE // Flip Y for canvas coordinates
    
    // Choose color based on tool
    const color = tool === 'erase' ? BASE_COLOR : brushColor
    
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (fromUV) {
      // Draw a line from previous position to current
      const fromX = fromUV.x * TEXTURE_SIZE
      const fromY = (1 - fromUV.y) * TEXTURE_SIZE
      
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      // Draw a circle at the point
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    
    texture.needsUpdate = true
  }, [ctx, texture, tool, brushColor, brushSize])

  // Get UV from mouse position using raycasting
  const getUVFromPointer = useCallback((): { x: number; y: number } | null => {
    if (!meshRef.current) return null
    
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)
    
    if (intersects.length > 0 && intersects[0]?.uv) {
      return { x: intersects[0].uv.x, y: intersects[0].uv.y }
    }
    
    return null
  }, [raycaster, pointer, camera])

  // Handle mouse events
  const handlePointerDown = useCallback((e: PointerEvent) => {
    console.log('[PaintableSphere] pointerdown, button:', e.button)
    
    // Only left mouse button for painting
    if (e.button !== 0) {
      console.log('[PaintableSphere] Ignoring non-left click for painting')
      return
    }
    
    isPainting.current = true
    const uv = getUVFromPointer()
    console.log('[PaintableSphere] Starting paint, UV:', uv)
    
    if (uv) {
      paintAtUV(uv)
      lastUV.current = uv
    }
  }, [getUVFromPointer, paintAtUV])

  const handlePointerMove = useCallback(() => {
    if (!isPainting.current) return
    
    const uv = getUVFromPointer()
    
    if (uv) {
      paintAtUV(uv, lastUV.current ?? undefined)
      lastUV.current = uv
    }
  }, [getUVFromPointer, paintAtUV])

  const handlePointerUp = useCallback(() => {
    if (isPainting.current) {
      console.log('[PaintableSphere] Stopped painting')
    }
    isPainting.current = false
    lastUV.current = null
  }, [])

  // Attach event listeners to canvas
  useEffect(() => {
    const domElement = gl.domElement
    
    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerUp)
    
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [gl, handlePointerDown, handlePointerMove, handlePointerUp])

  // Ensure texture updates are reflected
  useFrame(() => {
    if (texture) {
      texture.needsUpdate = false // Reset after each frame
    }
  })

  if (!texture) return null

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}
