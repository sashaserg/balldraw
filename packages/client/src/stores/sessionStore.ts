import { create } from 'zustand'
import { socketService, type User } from '../network/socket'
import { useEventStore } from './eventStore'

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
      console.log('[Session] Creating new session...')
      const response = await fetch('/api/sessions', { method: 'POST' })
      const data = await response.json()
      
      if (!data.sessionId) {
        throw new Error('Failed to create session')
      }
      
      console.log('[Session] Created session:', data.sessionId)
      
      // Preserve existing local events before joining
      const existingEvents = [...useEventStore.getState().events]
      console.log('[Session] Preserving', existingEvents.length, 'local events')
      
      // Join the session (this will clear events, but we'll restore them)
      const success = await get()._joinSessionInternal(data.sessionId, userName, true)
      
      // After joining, restore and upload pre-existing local events
      if (success && existingEvents.length > 0) {
        console.log('[Session] Restoring and uploading', existingEvents.length, 'pre-session events...')
        
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
      
      console.log('[Session] Joined successfully:', response)
      
      // Load existing events from the session
      // When creating a new session, don't clear - we'll restore local events after
      const eventStore = useEventStore.getState()
      if (!isCreating) {
        eventStore.clearEvents()
        if (response.eventLog.length > 0) {
          console.log('[Session] Loading', response.eventLog.length, 'events from session')
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
    console.log('[Session] Leaving session')
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
  console.log('[Session] Setting up socket listeners...')
  
  socketService.onUserJoined(({ user }) => {
    console.log('🎉 [Session] USER_JOINED event received!', user.name, user.id)
    const state = useSessionStore.getState()
    console.log('[Session] Current state - isInSession:', state.isInSession, 'users:', state.users.map(u => u.name))
    if (!state.isInSession) {
      console.log('[Session] Ignoring user_joined - not in session')
      return
    }
    state._addUser(user)
    console.log('[Session] Users after add:', useSessionStore.getState().users.map(u => u.name))
  })
  
  socketService.onUserLeft(({ userId, user }) => {
    console.log('[Session] User left:', user.name)
    useSessionStore.getState()._removeUser(userId)
  })
  
  socketService.onPaint((event) => {
    // Add all events from server (including our own - server is source of truth)
    console.log('[Session] Paint event received:', event.userId, event.type)
    useEventStore.getState().addRemoteEvents([event])
  })
}

// Initialize listeners
setupSocketListeners()
