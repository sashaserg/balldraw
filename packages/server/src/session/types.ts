export interface User {
  id: string        // Socket ID
  name: string
  color: string     // Assigned hex color
  joinedAt: number
}

export interface PaintEvent {
  id: string
  type: 'paint' | 'erase'
  userId: string
  timestamp: number
  position: { u: number; v: number }
  color: string
  brushSize: number
}

export interface CursorPosition {
  userId: string
  position: { u: number; v: number } | null  // null when off-sphere
}

export interface Session {
  id: string
  users: User[]
  eventLog: PaintEvent[]
  createdAt: number
}
