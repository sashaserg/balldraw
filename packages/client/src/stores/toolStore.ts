import { create } from 'zustand'

export type Tool = 'paint' | 'erase'

// Brush size range
export const MIN_BRUSH_SIZE = 5
export const MAX_BRUSH_SIZE = 60

export interface ToolState {
  tool: Tool
  brushColor: string
  brushSize: number
  // Available options
  colors: string[]
  // Actions
  setTool: (tool: Tool) => void
  toggleTool: () => void
  setBrushColor: (color: string) => void
  setBrushSize: (size: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'paint',
  brushColor: '#e74c3c', // Red
  brushSize: 20,
  
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
}))
