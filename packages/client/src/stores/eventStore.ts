import { create } from 'zustand'
import { nanoid } from 'nanoid'

// Position on the sphere surface (UV coordinates, 0-1 range)
export interface Position {
  u: number
  v: number
}

// A single paint stroke segment
export interface PaintEvent {
  id: string
  type: 'paint' | 'erase'
  userId: string
  timestamp: number
  strokeId: string           // Groups events into strokes for undo/redo
  position: Position
  fromPosition?: Position    // Previous position when dragging
  color: string
  brushSize: number
}

// Undo a stroke (makes it invisible)
export interface UndoEvent {
  id: string
  type: 'undo'
  userId: string
  timestamp: number
  strokeId: string           // The stroke being undone
}

// Redo a stroke (makes it visible again)
export interface RedoEvent {
  id: string
  type: 'redo'
  userId: string
  timestamp: number
  strokeId: string           // The stroke being redone
}

// Union type for all drawable events
export type DrawEvent = PaintEvent | UndoEvent | RedoEvent

// Type guards
export function isPaintEvent(event: DrawEvent): event is PaintEvent {
  return event.type === 'paint' || event.type === 'erase'
}

export function isUndoEvent(event: DrawEvent): event is UndoEvent {
  return event.type === 'undo'
}

export function isRedoEvent(event: DrawEvent): event is RedoEvent {
  return event.type === 'redo'
}

// ============================================================================
// VISIBILITY COMPUTATION
// ============================================================================
// Derives which strokes are visible from the event log.
// - Strokes start visible (when paint events exist)
// - Each undo makes the stroke invisible
// - Each redo makes the stroke visible again
// ============================================================================

export function computeVisibility(events: DrawEvent[]): Set<string> {
  const visibleStrokes = new Set<string>()
  
  // First pass: collect all strokeIds from paint events
  for (const event of events) {
    if (isPaintEvent(event)) {
      visibleStrokes.add(event.strokeId)
    }
  }
  
  // Second pass: process undo/redo in timestamp order
  // (events should already be sorted, but let's be safe)
  const undoRedoEvents = events.filter(e => e.type === 'undo' || e.type === 'redo')
  undoRedoEvents.sort((a, b) => a.timestamp - b.timestamp)
  
  for (const event of undoRedoEvents) {
    if (event.type === 'undo') {
      visibleStrokes.delete(event.strokeId)
    } else if (event.type === 'redo') {
      visibleStrokes.add(event.strokeId)
    }
  }
  
  return visibleStrokes
}

// ============================================================================
// STATE
// ============================================================================

interface EventState {
  // All events (append-only log - source of truth)
  events: DrawEvent[]
  
  // Current stroke being drawn (not yet committed)
  currentStroke: PaintEvent[]
  
  // strokeId for the current stroke being drawn
  currentStrokeId: string | null
  
  // For replay optimization
  lastReplayedIndex: number
  
  // Cached sorted events (invalidated when events change)
  _cachedSortedEvents: DrawEvent[] | null
  
  // Cached visibility (invalidated when events change)
  _cachedVisibility: Set<string> | null
  
  // Version for cache invalidation
  _cacheVersion: number
  
  // Actions
  addEvent: (event: Omit<PaintEvent, 'id' | 'timestamp' | 'strokeId'>) => PaintEvent
  commitStroke: () => void
  clearEvents: () => void
  
  // Undo/Redo (creates undo/redo events)
  undo: (userId: string) => UndoEvent | null
  redo: (userId: string) => RedoEvent | null
  canUndo: (userId: string) => boolean
  canRedo: (userId: string) => boolean
  getUndoableStrokeId: (userId: string) => string | null
  getRedoableStrokeId: (userId: string) => string | null
  getRedoStack: (userId: string) => string[]  // Cached redo stack for user
  
  // For receiving remote events
  addRemoteEvent: (event: DrawEvent) => void
  addRemoteEvents: (events: DrawEvent[]) => void
  
  // Get all events sorted by timestamp (cached)
  getAllEventsSorted: () => DrawEvent[]
  
  // Get only visible paint events (for rendering)
  getVisiblePaintEvents: () => PaintEvent[]
  
  // Get visibility set (cached)
  getVisibility: () => Set<string>
  
  // Signal that visibility changed (for full replay)
  _signalVisibilityChange: () => void
}

// Simple ID generator for local events
let eventCounter = 0
const generateEventId = () => `local-${++eventCounter}-${Date.now()}`
const generateStrokeId = () => `stroke-${nanoid(8)}`

// Module-level cache (outside Zustand to avoid re-render on cache update)
let sortedEventsCache: DrawEvent[] | null = null
let visibilityCache: Set<string> | null = null
let redoStacksCache: Map<string, string[]> | null = null  // userId -> redoStack

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentStroke: [],
  currentStrokeId: null,
  lastReplayedIndex: -1,
  _cachedSortedEvents: null,
  _cachedVisibility: null,
  _cacheVersion: 0,
  
  _signalVisibilityChange: () => {
    window.dispatchEvent(new CustomEvent('drawball:needsReplay'))
  },
  
  addEvent: (eventData) => {
    const state = get()
    
    // Generate a strokeId if this is the first event in a new stroke
    const strokeId = state.currentStrokeId ?? generateStrokeId()
    
    const event: PaintEvent = {
      ...eventData,
      id: generateEventId(),
      timestamp: Date.now(),
      strokeId,
    }
    
    sortedEventsCache = null // Invalidate cache
    visibilityCache = null
    redoStacksCache = null
    
    set({
      currentStroke: [...state.currentStroke, event],
      currentStrokeId: strokeId,
    })
    
    return event
  },
  
  commitStroke: () => {
    const { currentStroke, events } = get()
    
    if (currentStroke.length === 0) return
    
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    set({
      events: [...events, ...currentStroke],
      currentStroke: [],
      currentStrokeId: null,
    })
  },
  
  getUndoableStrokeId: (userId: string) => {
    const { events } = get()
    const visibility = get().getVisibility()
    
    // Find all visible strokes by this user
    const userStrokes: string[] = []
    for (const event of events) {
      if (isPaintEvent(event) && event.userId === userId && visibility.has(event.strokeId)) {
        if (!userStrokes.includes(event.strokeId)) {
          userStrokes.push(event.strokeId)
        }
      }
    }
    
    // Return the last one (most recent)
    return userStrokes.length > 0 ? userStrokes[userStrokes.length - 1]! : null
  },
  
  getRedoableStrokeId: (userId: string) => {
    const redoStack = get().getRedoStack(userId)
    return redoStack.length > 0 ? redoStack[redoStack.length - 1]! : null
  },
  
  undo: (userId: string) => {
    const strokeId = get().getUndoableStrokeId(userId)
    if (!strokeId) return null
    
    const undoEvent: UndoEvent = {
      id: generateEventId(),
      type: 'undo',
      userId,
      timestamp: Date.now(),
      strokeId,
    }
    
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    set((state) => ({
      events: [...state.events, undoEvent],
    }))
    
    // Signal that visibility changed - needs full replay
    get()._signalVisibilityChange()
    
    return undoEvent
  },
  
  redo: (userId: string) => {
    const strokeId = get().getRedoableStrokeId(userId)
    if (!strokeId) return null
    
    const redoEvent: RedoEvent = {
      id: generateEventId(),
      type: 'redo',
      userId,
      timestamp: Date.now(),
      strokeId,
    }
    
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    set((state) => ({
      events: [...state.events, redoEvent],
    }))
    
    // Signal that visibility changed - needs full replay
    get()._signalVisibilityChange()
    
    return redoEvent
  },
  
  canUndo: (userId: string) => {
    return get().getUndoableStrokeId(userId) !== null
  },
  
  canRedo: (userId: string) => {
    return get().getRedoableStrokeId(userId) !== null
  },
  
  clearEvents: () => {
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    set({
      events: [],
      currentStroke: [],
      currentStrokeId: null,
      lastReplayedIndex: -1,
    })
    
    window.dispatchEvent(new CustomEvent('drawball:needsReplay'))
  },
  
  addRemoteEvent: (event) => {
    const { events } = get()
    
    // Skip if we already have this event
    if (events.some(e => e.id === event.id)) return
    
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    // If it's an undo/redo event, we need to trigger a full replay
    const needsReplay = event.type === 'undo' || event.type === 'redo'
    
    set({
      events: [...events, event].sort((a, b) => a.timestamp - b.timestamp),
    })
    
    if (needsReplay) {
      get()._signalVisibilityChange()
    }
  },
  
  addRemoteEvents: (remoteEvents) => {
    const { events } = get()
    
    // Filter out duplicates
    const existingIds = new Set(events.map(e => e.id))
    const newEvents = remoteEvents.filter(e => !existingIds.has(e.id))
    
    if (newEvents.length === 0) return
    
    sortedEventsCache = null
    visibilityCache = null
    redoStacksCache = null
    
    // Check if any of the new events are undo/redo (need replay)
    const needsReplay = newEvents.some(e => e.type === 'undo' || e.type === 'redo')
    
    set({
      events: [...events, ...newEvents].sort((a, b) => a.timestamp - b.timestamp),
    })
    
    if (needsReplay) {
      get()._signalVisibilityChange()
    }
  },
  
  getAllEventsSorted: () => {
    const { events, currentStroke } = get()
    
    if (sortedEventsCache !== null) {
      return sortedEventsCache
    }
    
    const allEvents: DrawEvent[] = [...events, ...currentStroke]
    const sorted = allEvents.sort((a, b) => a.timestamp - b.timestamp)
    sortedEventsCache = sorted
    
    return sorted
  },
  
  getVisibility: () => {
    if (visibilityCache !== null) {
      return visibilityCache
    }
    
    const events = get().getAllEventsSorted()
    visibilityCache = computeVisibility(events)
    
    return visibilityCache
  },
  
  getRedoStack: (userId: string) => {
    // Compute all redo stacks if not cached
    if (redoStacksCache === null) {
      redoStacksCache = new Map()
      const events = get().getAllEventsSorted()
      
      // Build redo stacks for all users in one pass
      // Standard undo/redo semantics:
      // - On paint: clear redo stack (new action invalidates redo history)
      // - On undo: push strokeId to redo stack
      // - On redo: pop strokeId from redo stack
      for (const event of events) {
        const uid = event.userId
        if (!redoStacksCache.has(uid)) {
          redoStacksCache.set(uid, [])
        }
        const stack = redoStacksCache.get(uid)!
        
        if (isPaintEvent(event)) {
          stack.length = 0  // New stroke clears redo stack
        } else if (event.type === 'undo') {
          stack.push(event.strokeId)
        } else if (event.type === 'redo') {
          const idx = stack.lastIndexOf(event.strokeId)
          if (idx !== -1) stack.splice(idx, 1)
        }
      }
    }
    
    return redoStacksCache.get(userId) ?? []
  },

  getVisiblePaintEvents: () => {
    const events = get().getAllEventsSorted()
    const visibility = get().getVisibility()
    
    return events.filter(
      (e): e is PaintEvent => isPaintEvent(e) && visibility.has(e.strokeId)
    )
  },
}))
