import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { SessionManager } from './session/manager.js'
import { setupSocketHandlers } from './socket/handlers.js'

const PORT = process.env.PORT ?? 3001

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
})

// Session manager (in-memory for MVP)
const sessionManager = new SessionManager()

// REST API endpoints
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.post('/api/sessions', (_, res) => {
  const session = sessionManager.createSession()
  res.json({ sessionId: session.id })
})

app.get('/api/sessions/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json({
    id: session.id,
    userCount: session.users.length,
    maxUsers: 4,
  })
})

// WebSocket handlers
setupSocketHandlers(io, sessionManager)

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})
