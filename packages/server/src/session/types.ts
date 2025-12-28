export interface User {
  id: string        // Socket ID
  name: string
  color: string     // Assigned hex color
  joinedAt: number
}

// Position on sphere surface (UV coordinates)
export interface Position {
  u: number
  v: number
}

// A paint stroke segment
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

// Type guard helpers
export function isPaintEvent(event: DrawEvent): event is PaintEvent {
  return event.type === 'paint' || event.type === 'erase'
}

export function isUndoEvent(event: DrawEvent): event is UndoEvent {
  return event.type === 'undo'
}

export function isRedoEvent(event: DrawEvent): event is RedoEvent {
  return event.type === 'redo'
}

export interface CursorPosition {
  userId: string
  position: { x: number; y: number } | null  // null when outside canvas
}

export interface Session {
  id: string
  users: User[]
  eventLog: DrawEvent[]      // Now stores all event types
  createdAt: number
}
