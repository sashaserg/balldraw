import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useToolStore } from '../stores/toolStore'
import { useEventStore, type PaintEvent } from '../stores/eventStore'
import { useSessionStore } from '../stores/sessionStore'
import { socketService } from '../network/socket'
import { perfMonitor } from '../utils/perfMonitor'
import { sphereRoundBrush, type BrushConfig } from '../brushes'

// Canvas texture resolution (higher = more detail, but more memory)
const TEXTURE_SIZE = 4096

// Throttle: minimum ms between paint events (33ms = ~30 events/sec)
const PAINT_THROTTLE_MS = 33

interface PaintableSphereProps {
  rotation?: THREE.Quaternion
}

export function PaintableSphere({ rotation }: PaintableSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  
  const isPainting = useRef(false)
  const lastUV = useRef<{ u: number; v: number } | null>(null)
  const lastEventTime = useRef<number>(0)
  
  // Track which events we've already rendered (by ID)
  const renderedEventIds = useRef<Set<string>>(new Set())
  
  const { gl, camera, raycaster, pointer } = useThree()
  const { tool, brushColor, brushSize } = useToolStore()
  const { addEvent, commitStroke, getVisiblePaintEvents } = useEventStore()
  const { isInSession, currentUser } = useSessionStore()
  
  // Get userId - from session if connected, otherwise local
  const userId = currentUser?.id ?? 'local-user'

  // Initialize the canvas texture
  useEffect(() => {
    const newCanvas = document.createElement('canvas')
    newCanvas.width = TEXTURE_SIZE
    newCanvas.height = TEXTURE_SIZE
    
    const newCtx = newCanvas.getContext('2d')
    if (!newCtx) return
    
    // Fill with current background color from store (might have been loaded already)
    const currentBgColor = useEventStore.getState().bgColor
    newCtx.fillStyle = currentBgColor
    newCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    
    const newTexture = new THREE.CanvasTexture(newCanvas)
    // Improve texture quality
    newTexture.colorSpace = THREE.SRGBColorSpace
    newTexture.anisotropy = 16 // Sharper at angles
    newTexture.minFilter = THREE.LinearMipmapLinearFilter
    newTexture.magFilter = THREE.LinearFilter
    newTexture.generateMipmaps = true
    newTexture.needsUpdate = true
    
    canvasRef.current = newCanvas
    ctxRef.current = newCtx
    setTexture(newTexture)
    
    return () => {
      newTexture.dispose()
    }
  }, [])

  // Render a single event to the canvas using the sphere brush
  const renderEvent = useCallback((event: PaintEvent, baseColor: string) => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    const brushConfig: BrushConfig = {
      ctx,
      textureSize: TEXTURE_SIZE,
      baseColor,
    }
    
    sphereRoundBrush.render(event, brushConfig)
  }, [])

  // Full replay: clear canvas and render all visible events
  // Called when visibility changes (undo/redo) or on initial load
  const fullReplay = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    // Get current bg color and visible events
    const currentBgColor = useEventStore.getState().bgColor
    const events = useEventStore.getState().getVisiblePaintEvents()
    
    // Clear to current background color
    ctx.fillStyle = currentBgColor
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    
    // Render all visible events in order and track them
    renderedEventIds.current.clear()
    for (const event of events) {
      renderEvent(event, currentBgColor)
      renderedEventIds.current.add(event.id)
    }
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [renderEvent, texture])

  // Incremental render: only render visible events not yet rendered
  // This handles remote events that may be inserted in the middle (by timestamp)
  const incrementalRender = useCallback(() => {
    const events = perfMonitor.trackSort(() => getVisiblePaintEvents())
    
    if (events.length === 0) return
    
    // Find events that haven't been rendered yet
    const newEvents = events.filter(e => !renderedEventIds.current.has(e.id))
    if (newEvents.length === 0) return
    
    const currentBgColor = useEventStore.getState().bgColor
    perfMonitor.trackRender(newEvents.length)
    for (const event of newEvents) {
      renderEvent(event, currentBgColor)
      renderedEventIds.current.add(event.id)
    }
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [getVisiblePaintEvents, renderEvent, texture])

  // Get UV from mouse position using raycasting
  const getUVFromPointer = useCallback((): { u: number; v: number } | null => {
    if (!meshRef.current) return null
    
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)
    
    if (intersects.length > 0 && intersects[0]?.uv) {
      return { u: intersects[0].uv.x, v: intersects[0].uv.y }
    }
    
    return null
  }, [raycaster, pointer, camera])

  // Handle mouse events - now creates events instead of direct painting
  const handlePointerDown = useCallback((e: PointerEvent) => {
    // Only left mouse button for painting
    if (e.button !== 0) return
    
    isPainting.current = true
    const uv = getUVFromPointer()
    
    if (uv) {
      const eventData = {
        type: tool,
        position: uv,
        color: brushColor,
        brushSize,
        userId,
      }
      
      // Create the event locally (gets assigned strokeId)
      const event = addEvent(eventData)
      
      if (isInSession) {
        // Send to server for persistence and broadcast
        // Include strokeId so server uses the same one
        socketService.sendPaint({
          type: event.type,
          position: event.position,
          color: event.color,
          brushSize: event.brushSize,
          strokeId: event.strokeId,
        })
      }
      
      lastUV.current = uv
    }
  }, [getUVFromPointer, addEvent, tool, brushColor, brushSize, isInSession, userId])

  const handlePointerMove = useCallback(() => {
    const now = Date.now()
    const uv = getUVFromPointer()
    
    // Only paint if we're actively painting
    if (!isPainting.current) return
    
    // Throttle paint events
    if (now - lastEventTime.current < PAINT_THROTTLE_MS) return
    lastEventTime.current = now
    
    if (uv) {
      const eventData = {
        type: tool,
        position: uv,
        fromPosition: lastUV.current ?? undefined,
        color: brushColor,
        brushSize,
        userId,
      }
      
      // Create the event locally (uses same strokeId as the stroke in progress)
      const event = addEvent(eventData)
      
      if (isInSession) {
        // Send to server for persistence and broadcast
        socketService.sendPaint({
          type: event.type,
          position: event.position,
          fromPosition: event.fromPosition,
          color: event.color,
          brushSize: event.brushSize,
          strokeId: event.strokeId,
        })
      }
      
      lastUV.current = uv
    }
  }, [getUVFromPointer, addEvent, tool, brushColor, brushSize, isInSession, userId])

  const handlePointerUp = useCallback(() => {
    if (isPainting.current) {
      // Always commit stroke locally to move from currentStroke to events
      // This is needed for proper undo/redo tracking
      commitStroke()
    }
    isPainting.current = false
    lastUV.current = null
    
    // Clear cursor position when not hovering
    if (isInSession) {
      socketService.sendCursor(null)
    }
  }, [commitStroke, isInSession])

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

  // Clear canvas to background color
  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    const currentBgColor = useEventStore.getState().bgColor
    ctx.fillStyle = currentBgColor
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    renderedEventIds.current.clear()
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [texture])

  // Listen for replay signal (when joining session or clearing)
  useEffect(() => {
    const handleReplayNeeded = () => {
      renderedEventIds.current.clear()
      clearCanvas()
    }
    
    window.addEventListener('drawball:needsReplay', handleReplayNeeded)
    return () => window.removeEventListener('drawball:needsReplay', handleReplayNeeded)
  }, [clearCanvas])

  // Render events on each frame
  useFrame(() => {
    perfMonitor.frameStart()
    incrementalRender()
  })

  // Expose functions for debugging
  useEffect(() => {
    // @ts-expect-error - expose for debugging
    window.__drawball = {
      fullReplay,
      clearCanvas,
      getEvents: getVisiblePaintEvents,
      replayWithFlash: () => {
        const ctx = ctxRef.current
        if (!ctx || !texture) return
        
        // Flash white briefly to show replay is happening
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        texture.needsUpdate = true
        
        // After a short delay, do the actual replay
        setTimeout(() => {
          const currentBgColor = useEventStore.getState().bgColor
          ctx.fillStyle = currentBgColor
          ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
          renderedEventIds.current.clear()
          fullReplay()
        }, 100)
      }
    }
  }, [fullReplay, clearCanvas, getVisiblePaintEvents, texture])

  if (!texture) return null

  return (
    <mesh 
      ref={meshRef} 
      quaternion={rotation}
    >
      <sphereGeometry args={[1, 128, 128]} />
      <meshStandardMaterial 
        map={texture} 
        roughness={0.6}
        metalness={0.05}
      />
    </mesh>
  )
}
