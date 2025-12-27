import { nanoid } from 'nanoid'
import type { Session, User, PaintEvent } from './types.js'

// Pre-defined colors for users (up to 4)
const USER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']

export class SessionManager {
  private sessions = new Map<string, Session>()

  createSession(): Session {
    const id = nanoid(8)
    const session: Session = {
      id,
      users: [],
      eventLog: [],
      createdAt: Date.now(),
    }
    this.sessions.set(id, session)
    console.log(`📦 Session created: ${id}`)
    return session
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  deleteSession(id: string): boolean {
    console.log(`🗑️ Session deleted: ${id}`)
    return this.sessions.delete(id)
  }

  addUser(sessionId: string, socketId: string, name: string): User | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.users.length >= 4) return null

    // Find an available color
    const usedColors = new Set(session.users.map((u) => u.color))
    const color = USER_COLORS.find((c) => !usedColors.has(c)) ?? USER_COLORS[0]!

    const user: User = {
      id: socketId,
      name,
      color,
      joinedAt: Date.now(),
    }

    session.users.push(user)
    console.log(`👤 User joined: ${name} (${socketId}) -> Session ${sessionId}`)
    return user
  }

  removeUser(sessionId: string, socketId: string): User | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const index = session.users.findIndex((u) => u.id === socketId)
    if (index === -1) return null

    const [user] = session.users.splice(index, 1)
    console.log(`👋 User left: ${user?.name} (${socketId}) <- Session ${sessionId}`)

    // Clean up empty sessions after a delay
    if (session.users.length === 0) {
      setTimeout(() => {
        const current = this.sessions.get(sessionId)
        if (current && current.users.length === 0) {
          this.deleteSession(sessionId)
        }
      }, 60000) // 1 minute
    }

    return user ?? null
  }

  addEvent(sessionId: string, event: Omit<PaintEvent, 'id' | 'timestamp'>): PaintEvent | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const fullEvent: PaintEvent = {
      ...event,
      id: nanoid(12),
      timestamp: Date.now(),
    }

    session.eventLog.push(fullEvent)
    return fullEvent
  }

  getEvents(sessionId: string): PaintEvent[] {
    return this.sessions.get(sessionId)?.eventLog ?? []
  }

  getUsers(sessionId: string): User[] {
    return this.sessions.get(sessionId)?.users ?? []
  }
}
