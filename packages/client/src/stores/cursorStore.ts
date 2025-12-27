import { create } from 'zustand'

// 2D screen position (normalized 0-1)
export interface CursorPosition {
  x: number  // 0 = left, 1 = right
  y: number  // 0 = top, 1 = bottom
}

export interface RemoteCursor {
  userId: string
  userName: string
  color: string
  position: CursorPosition | null
  lastUpdate: number
  isDrawing: boolean  // True when user is actively drawing
}

interface CursorState {
  // Remote cursors from other users
  cursors: Map<string, RemoteCursor>
  
  // Track which users are currently drawing
  drawingUsers: Set<string>
  
  // Actions
  updateCursor: (userId: string, userName: string, color: string, position: CursorPosition | null) => void
  setUserDrawing: (userId: string, isDrawing: boolean) => void
  removeCursor: (userId: string) => void
  clearCursors: () => void
}

// Remove cursors that haven't been updated in 5 seconds
const CURSOR_TIMEOUT = 5000

// How long after last paint event to consider user "not drawing"
const DRAWING_TIMEOUT = 150

// Timers for clearing drawing state
const drawingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useCursorStore = create<CursorState>((set) => ({
  cursors: new Map(),
  drawingUsers: new Set(),
  
  updateCursor: (userId, userName, color, position) => {
    set((state) => {
      const newCursors = new Map(state.cursors)
      
      if (position === null) {
        // User lifted their cursor
        newCursors.delete(userId)
      } else {
        const existing = state.cursors.get(userId)
        newCursors.set(userId, {
          userId,
          userName,
          color,
          position,
          lastUpdate: Date.now(),
          isDrawing: existing?.isDrawing ?? false,
        })
      }
      
      return { cursors: newCursors }
    })
  },
  
  setUserDrawing: (userId, isDrawing) => {
    // Clear any existing timer for this user
    const existingTimer = drawingTimers.get(userId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      drawingTimers.delete(userId)
    }
    
    if (isDrawing) {
      // Set user as drawing immediately
      set((state) => {
        const newDrawingUsers = new Set(state.drawingUsers)
        newDrawingUsers.add(userId)
        
        // Also update cursor state
        const newCursors = new Map(state.cursors)
        const cursor = newCursors.get(userId)
        if (cursor) {
          newCursors.set(userId, { ...cursor, isDrawing: true })
        }
        
        return { drawingUsers: newDrawingUsers, cursors: newCursors }
      })
      
      // Set timer to clear drawing state after timeout
      const timer = setTimeout(() => {
        drawingTimers.delete(userId)
        set((state) => {
          const newDrawingUsers = new Set(state.drawingUsers)
          newDrawingUsers.delete(userId)
          
          const newCursors = new Map(state.cursors)
          const cursor = newCursors.get(userId)
          if (cursor) {
            newCursors.set(userId, { ...cursor, isDrawing: false })
          }
          
          return { drawingUsers: newDrawingUsers, cursors: newCursors }
        })
      }, DRAWING_TIMEOUT)
      
      drawingTimers.set(userId, timer)
    }
  },
  
  removeCursor: (userId) => {
    set((state) => {
      const newCursors = new Map(state.cursors)
      newCursors.delete(userId)
      return { cursors: newCursors }
    })
  },
  
  clearCursors: () => {
    set({ cursors: new Map() })
  },
}))

// Periodically clean up stale cursors
setInterval(() => {
  const state = useCursorStore.getState()
  const now = Date.now()
  let hasStale = false
  
  state.cursors.forEach((cursor) => {
    if (now - cursor.lastUpdate > CURSOR_TIMEOUT) {
      hasStale = true
    }
  })
  
  if (hasStale) {
    useCursorStore.setState((state) => {
      const newCursors = new Map()
      state.cursors.forEach((cursor, id) => {
        if (now - cursor.lastUpdate <= CURSOR_TIMEOUT) {
          newCursors.set(id, cursor)
        }
      })
      return { cursors: newCursors }
    })
  }
}, 1000)
