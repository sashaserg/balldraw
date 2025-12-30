import { create } from 'zustand'
import { nanoid } from 'nanoid'
import * as projectStorage from '../lib/projectStorage'
import type { ProjectMeta, Project } from '../lib/projectStorage'
import { useEventStore, isPaintEvent, computeVisibility } from './eventStore'

// ============================================================================
// PROJECT STATE - Manages projects and current project context
// ============================================================================

interface ProjectState {
  // List of all projects (metadata only for gallery)
  projects: ProjectMeta[]
  
  // Currently open project
  currentProject: Project | null
  
  // Whether current user is the host (owns the project)
  // When joining someone's session, this is false
  isHost: boolean
  
  // Loading states
  isLoading: boolean
  isSaving: boolean
  
  // Snapshot capture callback (set by Scene component)
  _captureSnapshot: (() => string | null) | null
  
  // Actions
  loadProjects: () => Promise<void>
  createProject: () => Promise<Project>
  openProject: (id: string) => Promise<Project | null>
  closeProject: () => void
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  
  // Save current project (debounced externally)
  saveCurrentProject: () => Promise<void>
  
  // Host management
  setIsHost: (isHost: boolean) => void
  
  // Snapshot registration (called by Scene)
  setCaptureSnapshot: (fn: (() => string | null) | null) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isHost: true,
  isLoading: false,
  isSaving: false,
  _captureSnapshot: null,
  
  setCaptureSnapshot: (fn) => {
    set({ _captureSnapshot: fn })
  },
  
  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await projectStorage.getAllProjects()
      set({ projects, isLoading: false })
    } catch (error) {
      console.error('[ProjectStore] Failed to load projects:', error)
      set({ isLoading: false })
    }
  },
  
  createProject: async () => {
    const id = nanoid(8)
    const project = await projectStorage.createProject(id)
    
    set((state) => ({
      projects: [
        { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
        ...state.projects,
      ],
      currentProject: project,
      isHost: true,
    }))
    
    // Clear event store for new project
    useEventStore.getState().clearEvents()
    
    return project
  },
  
  openProject: async (id: string) => {
    set({ isLoading: true })
    
    try {
      const project = await projectStorage.getProject(id)
      
      if (!project) {
        console.error('[ProjectStore] Project not found:', id)
        set({ isLoading: false })
        return null
      }
      
      // Load events into event store
      // Mark them as "historical" by prefixing userId so they can't be undone
      const eventStore = useEventStore.getState()
      eventStore.clearEvents()
      
      if (project.events.length > 0) {
        const historicalEvents = project.events.map(e => ({
          ...e,
          userId: `history:${e.userId}`,
        }))
        eventStore.addRemoteEvents(historicalEvents)
      }
      
      set({
        currentProject: project,
        isHost: true,
        isLoading: false,
      })
      
      return project
    } catch (error) {
      console.error('[ProjectStore] Failed to open project:', error)
      set({ isLoading: false })
      return null
    }
  },
  
  closeProject: () => {
    useEventStore.getState().clearEvents()
    set({
      currentProject: null,
      isHost: true,
    })
  },
  
  renameProject: async (id: string, name: string) => {
    await projectStorage.renameProject(id, name)
    
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, name, updatedAt: Date.now() }
          : state.currentProject,
    }))
  },
  
  deleteProject: async (id: string) => {
    await projectStorage.deleteProject(id)
    
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        state.currentProject?.id === id ? null : state.currentProject,
    }))
  },
  
  saveCurrentProject: async () => {
    const { currentProject, isHost, _captureSnapshot } = get()
    
    // Only save if we're the host and have a project open
    if (!currentProject || !isHost) return
    
    set({ isSaving: true })
    
    try {
      const allEvents = useEventStore.getState().events
      const now = Date.now()
      
      // Bake in visibility - only save visible paint events
      // This discards undo/redo history and compacts storage
      const visibility = computeVisibility(allEvents)
      const eventsToSave = allEvents.filter(
        e => isPaintEvent(e) && visibility.has(e.strokeId)
      )
      
      // Skip saving if no visible strokes (empty project)
      if (eventsToSave.length === 0) {
        set({ isSaving: false })
        return
      }
      
      // Capture thumbnail from current render
      const thumbnail = _captureSnapshot ? _captureSnapshot() : null
      
      await projectStorage.saveProject({
        ...currentProject,
        events: eventsToSave,
        updatedAt: now,
        thumbnail: thumbnail ?? currentProject.thumbnail,
        thumbnailUpdatedAt: thumbnail ? now : currentProject.thumbnailUpdatedAt,
      })
      
      // Update local state
      set((state) => ({
        currentProject: state.currentProject
          ? { 
              ...state.currentProject, 
              events: eventsToSave, 
              updatedAt: now,
              thumbnail: thumbnail ?? state.currentProject.thumbnail,
              thumbnailUpdatedAt: thumbnail ? now : state.currentProject.thumbnailUpdatedAt,
            }
          : null,
        isSaving: false,
      }))
    } catch (error) {
      console.error('[ProjectStore] Failed to save project:', error)
      set({ isSaving: false })
    }
  },
  
  setIsHost: (isHost: boolean) => {
    set({ isHost })
  },
}))
