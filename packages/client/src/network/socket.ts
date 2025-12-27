import { io, Socket } from 'socket.io-client'
import type { PaintEvent } from '../stores/eventStore'

// Event types for type safety
export interface User {
  id: string
  name: string
  color: string
  joinedAt: number
}

export type JoinSessionResponse = {
  success: true
  user: User
  users: User[]
  eventLog: PaintEvent[]
} | {
  error: 'SESSION_NOT_FOUND' | 'SESSION_FULL' | 'FAILED_TO_JOIN'
}

export interface ServerToClientEvents {
  user_joined: (data: { user: User }) => void
  user_left: (data: { userId: string; user: User }) => void
  paint: (event: PaintEvent) => void
  cursor_move: (data: { userId: string; position: { u: number; v: number } | null }) => void
}

export interface ClientToServerEvents {
  join_session: (
    data: { sessionId: string; userName: string },
    callback: (response: JoinSessionResponse) => void
  ) => void
  paint: (data: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>) => void
  cursor_move: (position: { u: number; v: number } | null) => void
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

class SocketService {
  private socket: TypedSocket | null = null
  private listenersSetup = false
  
  connect(): TypedSocket {
    // If we already have a socket, reuse it (keeps listeners intact)
    if (this.socket) {
      // Reconnect if disconnected
      if (!this.socket.connected) {
        console.log('[Socket] Reconnecting existing socket...')
        this.socket.connect()
      }
      return this.socket
    }
    
    console.log('[Socket] Creating socket connection...')
    
    this.socket = io('/', {
      transports: ['websocket'],
      autoConnect: true,
    }) as TypedSocket
    
    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id)
    })
    
    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })
    
    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
    })
    
    return this.socket
  }
  
  disconnect(): void {
    if (this.socket) {
      console.log('[Socket] Disconnecting (keeping socket for listeners)...')
      this.socket.disconnect()
      // Don't null out the socket - listeners are still attached to it
      // and socket.io will reconnect to the same instance when connect() is called
    }
  }
  
  // Reconnect a disconnected socket
  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('[Socket] Reconnecting...')
      this.socket.connect()
    }
  }
  
  getSocket(): TypedSocket | null {
    return this.socket
  }
  
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
  
  // Join a session
  joinSession(sessionId: string, userName: string): Promise<JoinSessionResponse> {
    return new Promise((resolve) => {
      const socket = this.connect()
      
      console.log('[Socket] Joining session:', sessionId, 'as', userName)
      
      socket.emit('join_session', { sessionId, userName }, (response) => {
        console.log('[Socket] Join response:', response)
        resolve(response)
      })
    })
  }
  
  // Send a paint event
  sendPaint(event: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send paint: not connected')
      return
    }
    
    this.socket.emit('paint', event)
  }
  
  // Send cursor position
  sendCursor(position: { u: number; v: number } | null): void {
    if (!this.socket?.connected) return
    this.socket.emit('cursor_move', position)
  }
  
  // Subscribe to paint events
  onPaint(callback: (event: PaintEvent) => void): () => void {
    const socket = this.connect()
    socket.on('paint', callback)
    return () => socket.off('paint', callback)
  }
  
  // Subscribe to user events
  onUserJoined(callback: (data: { user: User }) => void): () => void {
    const socket = this.connect()
    socket.on('user_joined', callback)
    return () => socket.off('user_joined', callback)
  }
  
  onUserLeft(callback: (data: { userId: string; user: User }) => void): () => void {
    const socket = this.connect()
    socket.on('user_left', callback)
    return () => socket.off('user_left', callback)
  }
  
  // Subscribe to cursor updates
  onCursorMove(callback: (data: { userId: string; position: { u: number; v: number } | null }) => void): () => void {
    const socket = this.connect()
    socket.on('cursor_move', callback)
    return () => socket.off('cursor_move', callback)
  }
}

// Singleton instance
export const socketService = new SocketService()
