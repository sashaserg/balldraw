import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useToolStore } from '../stores/toolStore'
import { useEventStore, type PaintEvent } from '../stores/eventStore'
import { useSessionStore } from '../stores/sessionStore'
import { socketService } from '../network/socket'

// Canvas texture resolution (higher = more detail, but more memory)
const TEXTURE_SIZE = 1024

// Base gray color for the sphere
const BASE_COLOR = '#a0a0a0'

// Throttle: minimum ms between paint events (33ms = ~30 events/sec)
const PAINT_THROTTLE_MS = 33

export function PaintableSphere() {
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  
  const isPainting = useRef(false)
  const lastUV = useRef<{ u: number; v: number } | null>(null)
  const lastEventTime = useRef<number>(0)
  
  // Track which events we've already rendered
  const lastRenderedEventId = useRef<string | null>(null)
  
  const { gl, camera, raycaster, pointer } = useThree()
  const { tool, brushColor, brushSize } = useToolStore()
  const { addEvent, commitStroke, getAllEventsSorted } = useEventStore()
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
    
    // Fill with base gray color
    newCtx.fillStyle = BASE_COLOR
    newCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    
    const newTexture = new THREE.CanvasTexture(newCanvas)
    newTexture.needsUpdate = true
    
    canvasRef.current = newCanvas
    ctxRef.current = newCtx
    setTexture(newTexture)
    
    return () => {
      newTexture.dispose()
    }
  }, [])

  // Render a single event to the canvas
  const renderEvent = useCallback((event: PaintEvent) => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    const x = event.position.u * TEXTURE_SIZE
    const y = (1 - event.position.v) * TEXTURE_SIZE // Flip Y for canvas coordinates
    
    // Choose color based on event type
    const color = event.type === 'erase' ? BASE_COLOR : event.color
    
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = event.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (event.fromPosition) {
      const fromU = event.fromPosition.u
      const toU = event.position.u
      const fromX = fromU * TEXTURE_SIZE
      const fromY = (1 - event.fromPosition.v) * TEXTURE_SIZE
      
      // Check for UV seam crossing (large jump in U coordinate)
      const uDistance = Math.abs(toU - fromU)
      
      if (uDistance > 0.5) {
        // Crossing the UV seam - draw two line segments that wrap around
        // Calculate the interpolated Y at the seam crossing
        const totalDistance = uDistance > 0.5 ? (1 - uDistance) : uDistance
        
        if (fromU > toU) {
          // Going from high U to low U (crossing right edge)
          // Segment 1: from start to right edge (u=1)
          const t1 = (1 - fromU) / ((1 - fromU) + toU)
          const seamY = fromY + (y - fromY) * t1
          
          ctx.beginPath()
          ctx.moveTo(fromX, fromY)
          ctx.lineTo(TEXTURE_SIZE, seamY)
          ctx.stroke()
          
          // Segment 2: from left edge (u=0) to end
          ctx.beginPath()
          ctx.moveTo(0, seamY)
          ctx.lineTo(x, y)
          ctx.stroke()
        } else {
          // Going from low U to high U (crossing left edge)
          // Segment 1: from start to left edge (u=0)
          const t1 = fromU / (fromU + (1 - toU))
          const seamY = fromY + (y - fromY) * t1
          
          ctx.beginPath()
          ctx.moveTo(fromX, fromY)
          ctx.lineTo(0, seamY)
          ctx.stroke()
          
          // Segment 2: from right edge (u=1) to end
          ctx.beginPath()
          ctx.moveTo(TEXTURE_SIZE, seamY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
      } else {
        // Normal case - draw a line from previous position to current
        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    } else {
      // Draw a circle at the point
      ctx.beginPath()
      ctx.arc(x, y, event.brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  // Full replay: clear canvas and render all events
  const fullReplay = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    const events = getAllEventsSorted()
    
    // Clear to base color
    ctx.fillStyle = BASE_COLOR
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    
    // Render all events in order
    for (const event of events) {
      renderEvent(event)
    }
    
    lastRenderedEventId.current = events[events.length - 1]?.id ?? null
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [getAllEventsSorted, renderEvent, texture])

  // Incremental render: only render new events since last render
  const incrementalRender = useCallback(() => {
    const events = getAllEventsSorted()
    
    if (events.length === 0) return
    
    // Find where we left off
    let startIndex = 0
    if (lastRenderedEventId.current) {
      const lastIndex = events.findIndex(e => e.id === lastRenderedEventId.current)
      if (lastIndex !== -1) {
        startIndex = lastIndex + 1
      }
    }
    
    // Render new events
    const newEvents = events.slice(startIndex)
    if (newEvents.length === 0) return
    
    for (const event of newEvents) {
      renderEvent(event)
    }
    
    lastRenderedEventId.current = events[events.length - 1]?.id ?? null
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [getAllEventsSorted, renderEvent, texture])

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
      }
      
      if (isInSession) {
        // Send to server - it will broadcast back to us and others
        socketService.sendPaint(eventData)
      } else {
        // Local mode - add directly to store
        addEvent({ ...eventData, userId })
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
      }
      
      if (isInSession) {
        // Send to server
        socketService.sendPaint(eventData)
      } else {
        // Local mode
        addEvent({ ...eventData, userId })
      }
      
      lastUV.current = uv
    }
  }, [getUVFromPointer, addEvent, tool, brushColor, brushSize, isInSession, userId])

  const handlePointerUp = useCallback(() => {
    if (isPainting.current) {
      // Only commit locally if not in session (server handles it)
      if (!isInSession) {
        commitStroke()
      }
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

  // Clear canvas to base color
  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    
    ctx.fillStyle = BASE_COLOR
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    lastRenderedEventId.current = null
    
    if (texture) {
      texture.needsUpdate = true
    }
  }, [texture])

  // Listen for replay signal (when joining session or clearing)
  useEffect(() => {
    const handleReplayNeeded = () => {
      lastRenderedEventId.current = null
      clearCanvas()
    }
    
    window.addEventListener('drawball:needsReplay', handleReplayNeeded)
    return () => window.removeEventListener('drawball:needsReplay', handleReplayNeeded)
  }, [clearCanvas])

  // Render events on each frame
  useFrame(() => {
    incrementalRender()
  })

  // Expose functions for debugging
  useEffect(() => {
    // @ts-expect-error - expose for debugging
    window.__drawball = {
      fullReplay,
      clearCanvas,
      getEvents: getAllEventsSorted,
      replayWithFlash: () => {
        const ctx = ctxRef.current
        if (!ctx || !texture) return
        
        // Flash white briefly to show replay is happening
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        texture.needsUpdate = true
        
        // After a short delay, do the actual replay
        setTimeout(() => {
          ctx.fillStyle = BASE_COLOR
          ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
          lastRenderedEventId.current = null
          fullReplay()
        }, 100)
      }
    }
  }, [fullReplay, clearCanvas, getAllEventsSorted, texture])

  if (!texture) return null

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}
