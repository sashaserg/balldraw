import { create } from 'zustand'

// Position on the sphere surface (UV coordinates, 0-1 range)
export interface Position {
  u: number
  v: number
}

// A single paint stroke segment (from one point to another, or a single dot)
export interface PaintEvent {
  id: string
  type: 'paint' | 'erase'
  userId: string
  timestamp: number
  position: Position
  fromPosition?: Position  // If dragging, the previous position
  color: string
  brushSize: number
}

// Stroke = a series of events from mousedown to mouseup
export interface Stroke {
  id: string
  userId: string
  events: PaintEvent[]
  startTime: number
  endTime?: number
}

// ============================================================================
// PERFORMANCE NOTES:
// ============================================================================
// ❌ Index map for O(1) lookup:
//    At 0.02ms, findIndex is negligible. Not worth the complexity.
//    Measured with 600+ events, still under 0.1ms. Revisit only if 50k+ events.
// ============================================================================

interface EventState {
  // All paint events (source of truth)
  events: PaintEvent[]
  
  // Current stroke being drawn (not yet committed)
  currentStroke: PaintEvent[]
  
  // Undo stack - stores strokes that can be undone (by current user)
  undoStack: PaintEvent[][]
  
  // Redo stack - stores strokes that were undone
  redoStack: PaintEvent[][]
  
  // For replay optimization
  lastReplayedIndex: number
  
  // Cached sorted events (invalidated when events change)
  _cachedSortedEvents: PaintEvent[] | null
  _cacheVersion: number
  
  // Actions
  addEvent: (event: Omit<PaintEvent, 'id' | 'timestamp'>) => PaintEvent
  commitStroke: () => void
  clearEvents: () => void
  
  // Undo/Redo (local strokes only)
  undo: (userId: string) => PaintEvent[] | null
  redo: (userId: string) => PaintEvent[] | null
  canUndo: (userId: string) => boolean
  canRedo: () => boolean
  
  // For receiving remote events
  addRemoteEvents: (events: PaintEvent[]) => void
  
  // Get all events sorted by timestamp (cached)
  getAllEventsSorted: () => PaintEvent[]
  
  // Invalidate cache (called internally when events change)
  _invalidateCache: () => void
}

// Simple ID generator (will be replaced by server-generated IDs in Phase 3)
let eventCounter = 0
const generateEventId = () => `local-${++eventCounter}-${Date.now()}`

// Module-level cache for sorted events (outside Zustand to avoid re-render on cache update)
let sortedEventsCache: PaintEvent[] | null = null
let cacheVersion = 0

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentStroke: [],
  undoStack: [],
  redoStack: [],
  lastReplayedIndex: -1,
  _cachedSortedEvents: null, // Unused, kept for interface compat
  _cacheVersion: 0,
  
  _invalidateCache: () => {
    sortedEventsCache = null
    cacheVersion++
  },
  
  addEvent: (eventData) => {
    const event: PaintEvent = {
      ...eventData,
      id: generateEventId(),
      timestamp: Date.now(),
    }
    
    sortedEventsCache = null // Invalidate cache
    
    set((state) => ({
      currentStroke: [...state.currentStroke, event],
    }))
    
    return event
  },
  
  commitStroke: () => {
    const { currentStroke, events, undoStack } = get()
    
    if (currentStroke.length === 0) return
    
    sortedEventsCache = null // Invalidate cache
    
    set({
      events: [...events, ...currentStroke],
      currentStroke: [],
      // Add stroke to undo stack
      undoStack: [...undoStack, currentStroke],
      // Clear redo stack when new stroke is made
      redoStack: [],
    })
  },
  
  undo: (userId: string) => {
    const { events, undoStack, redoStack } = get()
    
    // Find the last stroke by this user
    const userStrokes = undoStack.filter(stroke => 
      stroke.length > 0 && stroke[0]!.userId === userId
    )
    
    if (userStrokes.length === 0) return null
    
    const lastStroke = userStrokes[userStrokes.length - 1]!
    const strokeEventIds = new Set(lastStroke.map(e => e.id))
    
    // Remove these events from main events list
    const newEvents = events.filter(e => !strokeEventIds.has(e.id))
    
    // Remove from undo stack, add to redo
    const strokeIndex = undoStack.indexOf(lastStroke)
    const newUndoStack = [...undoStack]
    newUndoStack.splice(strokeIndex, 1)
    
    sortedEventsCache = null // Invalidate cache
    
    set({
      events: newEvents,
      undoStack: newUndoStack,
      redoStack: [...redoStack, lastStroke],
    })
    
    // Signal replay needed
    window.dispatchEvent(new CustomEvent('drawball:needsReplay'))
    
    return lastStroke
  },
  
  redo: (userId: string) => {
    const { events, undoStack, redoStack } = get()
    
    // Find the last undone stroke by this user
    const userStrokes = redoStack.filter(stroke => 
      stroke.length > 0 && stroke[0]!.userId === userId
    )
    
    if (userStrokes.length === 0) return null
    
    const strokeToRedo = userStrokes[userStrokes.length - 1]!
    
    // Remove from redo stack, add back to events and undo stack
    const strokeIndex = redoStack.indexOf(strokeToRedo)
    const newRedoStack = [...redoStack]
    newRedoStack.splice(strokeIndex, 1)
    
    sortedEventsCache = null // Invalidate cache
    
    set({
      events: [...events, ...strokeToRedo].sort((a, b) => a.timestamp - b.timestamp),
      undoStack: [...undoStack, strokeToRedo],
      redoStack: newRedoStack,
    })
    
    return strokeToRedo
  },
  
  canUndo: (userId: string) => {
    const { undoStack } = get()
    return undoStack.some(stroke => stroke.length > 0 && stroke[0]!.userId === userId)
  },
  
  canRedo: () => {
    return get().redoStack.length > 0
  },
  
  clearEvents: () => {
    sortedEventsCache = null // Invalidate cache
    
    set({
      events: [],
      currentStroke: [],
      undoStack: [],
      redoStack: [],
      lastReplayedIndex: -1,
    })
    // Signal that a full replay is needed
    window.dispatchEvent(new CustomEvent('drawball:needsReplay'))
  },
  
  addRemoteEvents: (remoteEvents) => {
    sortedEventsCache = null // Invalidate cache
    
    set((state) => ({
      events: [...state.events, ...remoteEvents].sort((a, b) => a.timestamp - b.timestamp),
    }))
  },
  
  getAllEventsSorted: () => {
    const { events, currentStroke } = get()
    
    // Return cached if available
    if (sortedEventsCache !== null) {
      return sortedEventsCache
    }
    
    // Compute and cache (module-level, no re-render)
    const sorted = [...events, ...currentStroke].sort((a, b) => a.timestamp - b.timestamp)
    sortedEventsCache = sorted
    
    return sorted
  },
}))
