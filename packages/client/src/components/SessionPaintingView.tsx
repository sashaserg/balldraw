import { useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'
import { Toolbar } from './Toolbar'
import { DebugPanel } from './DebugPanel'
import { SessionPanel } from './SessionPanel'
import { RemoteCursors } from './RemoteCursors'
import { useEventStore } from '../stores/eventStore'
import { useSessionStore } from '../stores/sessionStore'
import { socketService } from '../network/socket'

// Throttle for cursor updates (50ms = ~20 updates/sec)
const CURSOR_THROTTLE_MS = 50

/**
 * Painting view for users who join a session via invite link.
 * Unlike PaintingView, this does NOT have a project context - 
 * the canvas is purely synced from the session host.
 */
export function SessionPaintingView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { currentUser, isInSession, sessionId: currentSessionId } = useSessionStore()
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const lastCursorTime = useRef<number>(0)
  
  // Verify we're in the correct session
  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    
    // If not in session or in wrong session, redirect to join page
    if (!isInSession || currentSessionId !== sessionId) {
      navigate(`/join/${sessionId}`)
    }
  }, [sessionId, isInSession, currentSessionId, navigate])
  
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
          socketService.sendUndo(strokeId)
        }
      }
      
      // Ctrl+Y or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const { getRedoableStrokeId, redo } = useEventStore.getState()
        const strokeId = getRedoableStrokeId(userId)
        if (strokeId) {
          redo(userId)
          socketService.sendRedo(strokeId)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentUser])

  // Track mouse position and send cursor updates
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInSession) return
    
    const now = Date.now()
    if (now - lastCursorTime.current < CURSOR_THROTTLE_MS) return
    lastCursorTime.current = now
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    socketService.sendCursor({ x, y })
  }, [isInSession])

  const handleMouseLeave = useCallback(() => {
    if (!isInSession) return
    socketService.sendCursor(null)
  }, [isInSession])

  const handleLeave = () => {
    useSessionStore.getState().leaveSession()
    useEventStore.getState().clearEvents()
    navigate('/')
  }
  
  if (!isInSession) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}>Connecting...</div>
      </div>
    )
  }
  
  return (
    <>
      {/* Leave button */}
      <button onClick={handleLeave} style={styles.leaveButton} title="Leave session">
        ← Leave Session
      </button>

      {/* Session indicator */}
      <div style={styles.sessionIndicator}>
        <span style={styles.sessionDot} />
        Session: {sessionId?.slice(0, 8)}
      </div>

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
        
        {/* Remote cursors overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <RemoteCursors />
        </div>
      </div>
      
      <SessionPanel />
      <Toolbar />
      <DebugPanel />
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  spinner: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 18,
  },
  leaveButton: {
    position: 'fixed',
    top: 16,
    left: 16,
    padding: '8px 16px',
    background: 'rgba(17, 24, 39, 0.9)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    zIndex: 100,
    backdropFilter: 'blur(10px)',
    transition: 'background 0.2s',
  },
  sessionIndicator: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    background: 'rgba(17, 24, 39, 0.8)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    zIndex: 100,
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#4ade80',
    animation: 'pulse 2s infinite',
  },
}
