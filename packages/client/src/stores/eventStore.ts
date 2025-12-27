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

interface EventState {
  // All paint events (source of truth)
  events: PaintEvent[]
  
  // Current stroke being drawn (not yet committed)
  currentStroke: PaintEvent[]
  
  // For replay optimization
  lastReplayedIndex: number
  
  // Actions
  addEvent: (event: Omit<PaintEvent, 'id' | 'timestamp'>) => PaintEvent
  commitStroke: () => void
  clearEvents: () => void
  
  // For receiving remote events
  addRemoteEvents: (events: PaintEvent[]) => void
  
  // Get all events sorted by timestamp
  getAllEventsSorted: () => PaintEvent[]
}

// Simple ID generator (will be replaced by server-generated IDs in Phase 3)
let eventCounter = 0
const generateEventId = () => `local-${++eventCounter}-${Date.now()}`

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentStroke: [],
  lastReplayedIndex: -1,
  
  addEvent: (eventData) => {
    const event: PaintEvent = {
      ...eventData,
      id: generateEventId(),
      timestamp: Date.now(),
    }
    
    console.log('[EventStore] addEvent:', event.type, 'at', event.position)
    
    set((state) => ({
      currentStroke: [...state.currentStroke, event],
    }))
    
    return event
  },
  
  commitStroke: () => {
    const { currentStroke, events } = get()
    
    if (currentStroke.length === 0) return
    
    console.log('[EventStore] commitStroke:', currentStroke.length, 'events')
    
    set({
      events: [...events, ...currentStroke],
      currentStroke: [],
    })
  },
  
  clearEvents: () => {
    console.log('[EventStore] clearEvents')
    set({
      events: [],
      currentStroke: [],
      lastReplayedIndex: -1,
    })
    // Signal that a full replay is needed
    window.dispatchEvent(new CustomEvent('drawball:needsReplay'))
  },
  
  addRemoteEvents: (remoteEvents) => {
    console.log('[EventStore] addRemoteEvents:', remoteEvents.length)
    set((state) => ({
      events: [...state.events, ...remoteEvents].sort((a, b) => a.timestamp - b.timestamp),
    }))
  },
  
  getAllEventsSorted: () => {
    const { events, currentStroke } = get()
    return [...events, ...currentStroke].sort((a, b) => a.timestamp - b.timestamp)
  },
}))
