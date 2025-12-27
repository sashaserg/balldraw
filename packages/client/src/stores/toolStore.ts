import { create } from 'zustand'

export type Tool = 'paint' | 'erase'

export interface ToolState {
  tool: Tool
  brushColor: string
  brushSize: number
  // Available options
  colors: string[]
  sizes: number[]
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
  
  sizes: [10, 20, 40],
  
  setTool: (tool) => {
    console.log('[ToolStore] setTool:', tool)
    set({ tool })
  },
  toggleTool: () => set((state) => {
    const newTool = state.tool === 'paint' ? 'erase' : 'paint'
    console.log('[ToolStore] toggleTool:', state.tool, '->', newTool)
    return { tool: newTool }
  }),
  setBrushColor: (brushColor) => set({ brushColor }),
  setBrushSize: (brushSize) => set({ brushSize }),
}))
