import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DrawEvent } from '../stores/eventStore'

// ============================================================================
// PROJECT STORAGE - IndexedDB layer for local project persistence
// ============================================================================

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  thumbnail?: string           // Cached thumbnail data URL
  thumbnailUpdatedAt?: number  // When thumbnail was last generated
}

export interface Project extends ProjectMeta {
  events: DrawEvent[]
}

interface DrawballDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated': number }
  }
}

const DB_NAME = 'drawball'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<DrawballDB>> | null = null

function getDB(): Promise<IDBPDatabase<DrawballDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DrawballDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }
  return dbPromise
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function getAllProjects(): Promise<ProjectMeta[]> {
  const db = await getDB()
  const projects = await db.getAllFromIndex('projects', 'by-updated')
  
  // Return metadata only, sorted by most recently updated first
  return projects
    .map(({ id, name, createdAt, updatedAt, thumbnail, thumbnailUpdatedAt }) => ({ 
      id, name, createdAt, updatedAt, thumbnail, thumbnailUpdatedAt 
    }))
    .reverse()
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', {
    ...project,
    updatedAt: Date.now(),
  })
}

export async function createProject(id: string): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id,
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    events: [],
  }
  
  const db = await getDB()
  await db.add('projects', project)
  
  return project
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDB()
  const project = await db.get('projects', id)
  
  if (!project) {
    throw new Error(`Project ${id} not found`)
  }
  
  await db.put('projects', {
    ...project,
    name,
    updatedAt: Date.now(),
  })
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
}

// ============================================================================
// Utilities
// ============================================================================

export async function projectExists(id: string): Promise<boolean> {
  const db = await getDB()
  const project = await db.get('projects', id)
  return project !== undefined
}
