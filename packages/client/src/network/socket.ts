import { io, Socket } from 'socket.io-client'
import type { PaintEvent } from '../stores/eventStore'

// Server URL - in dev uses Vite proxy ('/'), in prod uses env var
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '/'

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
  cursor_move: (data: { userId: string; position: { x: number; y: number } | null }) => void
}

export interface ClientToServerEvents {
  join_session: (
    data: { sessionId: string; userName: string },
    callback: (response: JoinSessionResponse) => void
  ) => void
  paint: (data: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>) => void
  cursor_move: (position: { x: number; y: number } | null) => void
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

class SocketService {
  private socket: TypedSocket | null = null
  
  connect(): TypedSocket {
    // If we already have a socket, reuse it (keeps listeners intact)
    if (this.socket) {
      // Reconnect if disconnected
      if (!this.socket.connected) {
        this.socket.connect()
      }
      return this.socket
    }
    
    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as TypedSocket
    
    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
    })
    
    return this.socket
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      // Don't null out the socket - listeners are still attached to it
      // and socket.io will reconnect to the same instance when connect() is called
    }
  }
  
  // Subscribe to connection events
  onConnect(callback: () => void): () => void {
    const socket = this.connect()
    socket.on('connect', callback)
    return () => socket.off('connect', callback)
  }
  
  onDisconnect(callback: (reason: string) => void): () => void {
    const socket = this.connect()
    socket.on('disconnect', callback)
    return () => socket.off('disconnect', callback)
  }
  
  // Reconnect a disconnected socket
  reconnect(): void {
    if (this.socket && !this.socket.connected) {
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
      
      socket.emit('join_session', { sessionId, userName }, (response) => {
        resolve(response)
      })
    })
  }
  
  // Send a paint event
  sendPaint(event: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] sendPaint: not connected, dropping event')
      return
    }
    
    console.log('[Socket] sendPaint:', { type: event.type, position: event.position })
    this.socket.emit('paint', event)
  }
  
  // Send cursor position (2D normalized screen coordinates)
  sendCursor(position: { x: number; y: number } | null): void {
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
  onCursorMove(callback: (data: { userId: string; position: { x: number; y: number } | null }) => void): () => void {
    const socket = this.connect()
    socket.on('cursor_move', callback)
    return () => socket.off('cursor_move', callback)
  }
}

// Singleton instance
export const socketService = new SocketService()
