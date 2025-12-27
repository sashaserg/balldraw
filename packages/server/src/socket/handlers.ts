import type { Server, Socket } from 'socket.io'
import type { SessionManager } from '../session/manager.js'
import type { PaintEvent, CursorPosition } from '../session/types.js'

// Track which session each socket is in
const socketSessions = new Map<string, string>()

export function setupSocketHandlers(io: Server, sessionManager: SessionManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`)

    // Join a session
    socket.on('join_session', (data: { sessionId: string; userName: string }, callback) => {
      const { sessionId, userName } = data

      const session = sessionManager.getSession(sessionId)
      if (!session) {
        callback({ error: 'SESSION_NOT_FOUND' })
        return
      }

      if (session.users.length >= 4) {
        callback({ error: 'SESSION_FULL' })
        return
      }

      const user = sessionManager.addUser(sessionId, socket.id, userName)
      if (!user) {
        callback({ error: 'FAILED_TO_JOIN' })
        return
      }

      // Track this socket's session
      socketSessions.set(socket.id, sessionId)

      // Join the Socket.IO room
      socket.join(sessionId)
      
      console.log(`📢 User ${userName} joined session ${sessionId}, room has ${io.sockets.adapter.rooms.get(sessionId)?.size || 0} members`)

      // Send current state to the new user
      callback({
        success: true,
        user,
        users: sessionManager.getUsers(sessionId),
        eventLog: sessionManager.getEvents(sessionId),
      })

      // Notify others in the session (everyone except the joining user)
      console.log(`📣 Broadcasting user_joined to session ${sessionId} (excluding ${socket.id})`)
      socket.to(sessionId).emit('user_joined', { user })
    })

    // Handle paint/erase events
    socket.on('paint', (data: Omit<PaintEvent, 'id' | 'timestamp' | 'userId'>) => {
      const sessionId = socketSessions.get(socket.id)
      if (!sessionId) return

      const event = sessionManager.addEvent(sessionId, {
        ...data,
        userId: socket.id,
      })

      if (event) {
        // Broadcast to everyone in the session (including sender for confirmation)
        io.to(sessionId).emit('paint', event)
      }
    })

    // Handle cursor movement
    socket.on('cursor_move', (position: { u: number; v: number } | null) => {
      const sessionId = socketSessions.get(socket.id)
      if (!sessionId) return

      const cursorData: CursorPosition = {
        userId: socket.id,
        position,
      }

      // Broadcast to others (not sender)
      socket.to(sessionId).emit('cursor_move', cursorData)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`)

      const sessionId = socketSessions.get(socket.id)
      if (sessionId) {
        const user = sessionManager.removeUser(sessionId, socket.id)
        if (user) {
          socket.to(sessionId).emit('user_left', { userId: socket.id, user })
        }
        socketSessions.delete(socket.id)
      }
    })
  })
}
