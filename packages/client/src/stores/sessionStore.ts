import { create } from 'zustand'
import { socketService, type User } from '../network/socket'
import { useEventStore } from './eventStore'
import { useCursorStore } from './cursorStore'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface SessionState {
  // Session info
  sessionId: string | null
  isInSession: boolean
  
  // Current user
  currentUser: User | null
  
  // All users in session
  users: User[]
  
  // Connection status
  status: ConnectionStatus
  error: string | null
  
  // Actions
  createSession: (userName: string) => Promise<boolean>
  joinSession: (sessionId: string, userName: string) => Promise<boolean>
  leaveSession: () => void
  
  // Internal actions (called by socket events)
  _addUser: (user: User) => void
  _removeUser: (userId: string) => void
  _setStatus: (status: ConnectionStatus, error?: string) => void
  _joinSessionInternal: (sessionId: string, userName: string, isCreating: boolean) => Promise<boolean>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  isInSession: false,
  currentUser: null,
  users: [],
  status: 'disconnected',
  error: null,
  
  createSession: async (userName: string) => {
    set({ status: 'connecting', error: null })
    
    try {
      // Create session via REST API
      const response = await fetch('/api/sessions', { method: 'POST' })
      const data = await response.json()
      
      if (!data.sessionId) {
        throw new Error('Failed to create session')
      }
      
      // Preserve existing local events before joining
      const existingEvents = [...useEventStore.getState().events]
      
      // Join the session (this will clear events, but we'll restore them)
      const success = await get()._joinSessionInternal(data.sessionId, userName, true)
      
      // After joining, restore and upload pre-existing local events
      if (success && existingEvents.length > 0) {
        // First restore them locally so the canvas isn't blank
        useEventStore.getState().addRemoteEvents(existingEvents)
        
        // Then send to server so others can see them
        for (const event of existingEvents) {
          socketService.sendPaint({
            type: event.type,
            position: event.position,
            fromPosition: event.fromPosition,
            color: event.color,
            brushSize: event.brushSize,
          })
        }
      }
      
      return success
    } catch (error) {
      console.error('[Session] Create failed:', error)
      set({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to create session' 
      })
      return false
    }
  },
  
  joinSession: async (sessionId: string, userName: string) => {
    return get()._joinSessionInternal(sessionId, userName, false)
  },
  
  _joinSessionInternal: async (sessionId: string, userName: string, isCreating: boolean) => {
    set({ status: 'connecting', error: null })
    
    try {
      const response = await socketService.joinSession(sessionId, userName)
      
      if ('error' in response) {
        const errorMessages = {
          SESSION_NOT_FOUND: 'Session not found',
          SESSION_FULL: 'Session is full (max 4 users)',
          FAILED_TO_JOIN: 'Failed to join session',
        }
        throw new Error(errorMessages[response.error])
      }
      
      // Load existing events from the session
      // When creating a new session, don't clear - we'll restore local events after
      const eventStore = useEventStore.getState()
      if (!isCreating) {
        eventStore.clearEvents()
        if (response.eventLog.length > 0) {
          eventStore.addRemoteEvents(response.eventLog)
        }
      }
      
      set({
        sessionId,
        isInSession: true,
        currentUser: response.user,
        users: response.users,
        status: 'connected',
        error: null,
      })
      
      return true
    } catch (error) {
      console.error('[Session] Join failed:', error)
      set({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to join session' 
      })
      return false
    }
  },
  
  leaveSession: () => {
    socketService.disconnect()
    
    // Clear events when leaving
    useEventStore.getState().clearEvents()
    
    set({
      sessionId: null,
      isInSession: false,
      currentUser: null,
      users: [],
      status: 'disconnected',
      error: null,
    })
  },
  
  _addUser: (user: User) => {
    set((state) => ({
      users: [...state.users, user],
    }))
  },
  
  _removeUser: (userId: string) => {
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
    }))
  },
  
  _setStatus: (status: ConnectionStatus, error?: string) => {
    set({ status, error: error ?? null })
  },
}))

// Setup socket event listeners (runs once on import)
function setupSocketListeners() {
  socketService.onUserJoined(({ user }) => {
    const state = useSessionStore.getState()
    if (!state.isInSession) return
    state._addUser(user)
  })
  
  socketService.onUserLeft(({ userId }) => {
    useSessionStore.getState()._removeUser(userId)
    useCursorStore.getState().removeCursor(userId)
  })
  
  socketService.onCursorMove(({ userId, position }) => {
    const state = useSessionStore.getState()
    if (!state.isInSession) return
    
    // Find user info for this cursor
    const user = state.users.find(u => u.id === userId)
    if (user) {
      useCursorStore.getState().updateCursor(userId, user.name, user.color, position)
    }
  })
  
  socketService.onPaint((event) => {
    // Add all events from server (including our own - server is source of truth)
    useEventStore.getState().addRemoteEvents([event])
    
    // Mark this user as drawing (to hide their cursor while painting)
    useCursorStore.getState().setUserDrawing(event.userId, true)
  })
  
  // Handle reconnection - re-join the session when socket reconnects
  socketService.onConnect(() => {
    const state = useSessionStore.getState()
    
    // If we were in a session, try to re-join
    if (state.sessionId && state.currentUser && state.status !== 'connected') {
      state._setStatus('connecting')
      
      // Re-join the session
      socketService.joinSession(state.sessionId, state.currentUser.name)
        .then((response) => {
          if ('error' in response) {
            console.error('[Session] Failed to re-join:', response.error)
            state._setStatus('error', 'Failed to reconnect to session')
          } else {
            // Update user list and sync events
            useSessionStore.setState({
              currentUser: response.user,
              users: response.users,
              status: 'connected',
              error: null,
            })
            
            // Sync any events we might have missed
            const eventStore = useEventStore.getState()
            const currentEvents = eventStore.events
            const serverEvents = response.eventLog
            
            // Find events we don't have
            const currentIds = new Set(currentEvents.map(e => e.id))
            const newEvents = serverEvents.filter(e => !currentIds.has(e.id))
            
            if (newEvents.length > 0) {
              eventStore.addRemoteEvents(newEvents)
            }
          }
        })
        .catch(() => {
          state._setStatus('error', 'Connection lost')
        })
    }
  })
  
  // Handle disconnection - update status
  socketService.onDisconnect((reason) => {
    const state = useSessionStore.getState()
    
    if (state.isInSession) {
      // If server initiated disconnect, don't try to reconnect
      if (reason === 'io server disconnect') {
        state._setStatus('error', 'Disconnected by server')
      } else {
        // Socket.IO will auto-reconnect, show connecting status
        state._setStatus('connecting')
      }
      
      // Clear remote cursors
      useCursorStore.getState().clearCursors()
    }
  })
}

// Initialize listeners
setupSocketListeners()
