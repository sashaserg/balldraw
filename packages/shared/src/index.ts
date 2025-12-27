// ============================================
// User & Session Types
// ============================================

export interface User {
  id: string
  name: string
  color: string
  joinedAt: number
}

export interface Session {
  id: string
  users: User[]
  eventLog: PaintEvent[]
  createdAt: number
}

// ============================================
// Paint Event Types
// ============================================

export interface Position {
  u: number
  v: number
}

// 2D screen position for cursor display (normalized 0-1)
export interface Position2D {
  x: number
  y: number
}

export interface PaintEvent {
  id: string
  type: 'paint' | 'erase'
  userId: string
  timestamp: number
  position: Position
  color: string
  brushSize: number
}

export interface CursorPosition {
  userId: string
  position: Position2D | null  // 2D screen position
}

// ============================================
// Socket.IO Event Types (Client -> Server)
// ============================================

export interface ClientToServerEvents {
  join_session: (
    data: { sessionId: string; userName: string },
    callback: (response: JoinSessionResponse) => void
  ) => void
  paint: (data: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>) => void
  cursor_move: (position: Position2D | null) => void
}

// ============================================
// Socket.IO Event Types (Server -> Client)
// ============================================

export interface ServerToClientEvents {
  user_joined: (data: { user: User }) => void
  user_left: (data: { userId: string; user: User }) => void
  paint: (event: PaintEvent) => void
  cursor_move: (data: CursorPosition) => void
}

// ============================================
// API Response Types
// ============================================

export type JoinSessionResponse =
  | {
      success: true
      user: User
      users: User[]
      eventLog: PaintEvent[]
    }
  | {
      error: 'SESSION_NOT_FOUND' | 'SESSION_FULL' | 'FAILED_TO_JOIN'
    }

export interface CreateSessionResponse {
  sessionId: string
}

export interface GetSessionResponse {
  id: string
  userCount: number
  maxUsers: number
}
