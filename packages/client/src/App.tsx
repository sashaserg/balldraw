import { useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { Toolbar } from './components/Toolbar'
import { DebugPanel } from './components/DebugPanel'
import { SessionPanel } from './components/SessionPanel'
import { RemoteCursors } from './components/RemoteCursors'
import { useEventStore } from './stores/eventStore'
import { useSessionStore } from './stores/sessionStore'
import { socketService } from './network/socket'

// Throttle for cursor updates (50ms = ~20 updates/sec)
const CURSOR_THROTTLE_MS = 50

export default function App() {
  const { currentUser, isInSession } = useSessionStore()
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const lastCursorTime = useRef<number>(0)
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const userId = currentUser?.id ?? 'local-user'
      
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const { getUndoableStrokeId, undo } = useEventStore.getState()
        const strokeId = getUndoableStrokeId(userId)
        if (strokeId) {
          undo(userId)
          if (isInSession) {
            socketService.sendUndo(strokeId)
          }
        }
      }
      
      // Ctrl+Y or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const { getRedoableStrokeId, redo } = useEventStore.getState()
        const strokeId = getRedoableStrokeId(userId)
        if (strokeId) {
          redo(userId)
          if (isInSession) {
            socketService.sendRedo(strokeId)
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isInSession, currentUser])

  // Track mouse position and send cursor updates when in session
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInSession) return
    
    const now = Date.now()
    if (now - lastCursorTime.current < CURSOR_THROTTLE_MS) return
    lastCursorTime.current = now
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    // Normalize to 0-1 range
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    socketService.sendCursor({ x, y })
  }, [isInSession])

  // Send null cursor when mouse leaves the canvas area
  const handleMouseLeave = useCallback(() => {
    if (!isInSession) return
    socketService.sendCursor(null)
  }, [isInSession])
  
  return (
    <>
      {/* Canvas container with cursor tracking */}
      <div
        ref={canvasContainerRef}
        style={{ position: 'absolute', inset: 0 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Scene />
        </Canvas>
        
        {/* Remote cursors overlay - only visible in session */}
        {isInSession && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <RemoteCursors />
          </div>
        )}
      </div>
      
      <SessionPanel />
      <Toolbar />
      <DebugPanel />
    </>
  )
}
