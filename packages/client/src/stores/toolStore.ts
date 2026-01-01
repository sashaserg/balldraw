import { create } from 'zustand'

export type Tool = 'paint' | 'erase'
export type RotationMode = 'camera' | 'ball'

// Brush size range
export const MIN_BRUSH_SIZE = 5
export const MAX_BRUSH_SIZE = 120

// Camera distance range (from OrbitControls)
export const DEFAULT_CAMERA_DISTANCE = 3
export const MIN_CAMERA_DISTANCE = 2
export const MAX_CAMERA_DISTANCE = 6

export interface ToolState {
  tool: Tool
  brushColor: string
  brushSize: number
  rotationMode: RotationMode
  cameraDistance: number  // Current camera distance from sphere center
  // Available options
  colors: string[]
  // Actions
  setTool: (tool: Tool) => void
  toggleTool: () => void
  setBrushColor: (color: string) => void
  setBrushSize: (size: number) => void
  setRotationMode: (mode: RotationMode) => void
  toggleRotationMode: () => void
  setCameraDistance: (distance: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'paint',
  brushColor: '#e74c3c', // Red
  brushSize: 20,
  rotationMode: 'camera', // Default to camera rotation (ball rotation available but hidden)
  cameraDistance: DEFAULT_CAMERA_DISTANCE,
  
  colors: [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#ffffff', // White
    '#2c3e50', // Dark
  ],
  
  setTool: (tool) => set({ tool }),
  toggleTool: () => set((state) => ({
    tool: state.tool === 'paint' ? 'erase' : 'paint'
  })),
  setBrushColor: (brushColor) => set({ brushColor }),
  setBrushSize: (size) => set({ 
    brushSize: Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, size)) 
  }),
  setRotationMode: (rotationMode) => set({ rotationMode }),
  toggleRotationMode: () => set((state) => ({
    rotationMode: state.rotationMode === 'camera' ? 'ball' : 'camera'
  })),
  setCameraDistance: (cameraDistance) => set({ cameraDistance }),
}))
