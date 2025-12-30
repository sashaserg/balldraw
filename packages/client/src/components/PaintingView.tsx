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
import { useProjectStore } from '../stores/projectStore'
import { socketService } from '../network/socket'

// Throttle for cursor updates (50ms = ~20 updates/sec)
const CURSOR_THROTTLE_MS = 50

// Debounce delay for auto-save (2 seconds after last change)
const AUTO_SAVE_DELAY_MS = 2000

export function PaintingView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentUser, isInSession } = useSessionStore()
  const { currentProject, openProject, isLoading, saveCurrentProject, isHost } = useProjectStore()
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const lastCursorTime = useRef<number>(0)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Auto-save when events change (debounced)
  useEffect(() => {
    if (!currentProject || !isHost) return
    
    // Subscribe to event store changes
    const unsubscribe = useEventStore.subscribe((state, prevState) => {
      // Only trigger save when committed events change (not currentStroke)
      if (state.events !== prevState.events && state.events.length > 0) {
        // Clear any pending save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        
        // Schedule save after debounce period
        saveTimeoutRef.current = setTimeout(() => {
          saveCurrentProject()
        }, AUTO_SAVE_DELAY_MS)
      }
    })
    
    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentProject, isHost, saveCurrentProject])
  
  // Load project on mount
  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    
    // Only load if we don't have the project already (or it's a different one)
    if (!currentProject || currentProject.id !== projectId) {
      openProject(projectId).then((project) => {
        if (!project) {
          // Project not found, go back to projects list
          navigate('/')
        }
      })
    }
  }, [projectId, currentProject, openProject, navigate])
  
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
      
      // Escape to go back to projects
      if (e.key === 'Escape' && !isInSession) {
        navigate('/')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isInSession, currentUser, navigate])

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

  const handleBack = async () => {
    // Save before leaving to capture thumbnail
    await saveCurrentProject()
    
    if (isInSession) {
      // Leave session first
      useSessionStore.getState().leaveSession()
    }
    
    // Close project so it reloads fresh next time
    useProjectStore.getState().closeProject()
    
    navigate('/')
  }
  
  if (isLoading || !currentProject) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}>Loading...</div>
      </div>
    )
  }
  
  return (
    <>
      {/* Back button */}
      <button onClick={handleBack} style={styles.backButton} title="Back to projects (Esc)">
        ← Projects
      </button>

      {/* Project name */}
      <div style={styles.projectName}>{currentProject.name}</div>

      {/* Canvas container with cursor tracking */}
      <div
        ref={canvasContainerRef}
        style={{ position: 'absolute', inset: 0 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ preserveDrawingBuffer: true }}
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
  backButton: {
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
  projectName: {
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
  },
}
