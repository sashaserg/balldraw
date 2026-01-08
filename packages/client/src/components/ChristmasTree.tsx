/**
 * ChristmasTree React Component
 * 
 * Renders the Christmas tree with ornament anchors.
 * Provides access to anchor points for attaching user-generated ornaments.
 */

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import {
  loadChristmasTree,
  createAnchorDebugVisualization,
  logDiagnostics,
  type TreeLoadResult,
  type OrnamentAnchor,
} from '../lib/christmasTree'

// ============================================================================
// TYPES
// ============================================================================

export interface ChristmasTreeProps {
  /** Show debug visualization of anchor points */
  showAnchors?: boolean
  /** Called when tree finishes loading */
  onLoad?: (result: TreeLoadResult) => void
  /** Called if loading fails */
  onError?: (error: Error) => void
  /** Position of the tree */
  position?: [number, number, number]
  /** Rotation of the tree (euler angles) */
  rotation?: [number, number, number]
  /** Scale multiplier */
  scale?: number
}

export interface ChristmasTreeHandle {
  /** Get all ornament anchors */
  getAnchors: () => OrnamentAnchor[]
  /** Get anchor by index */
  getAnchor: (index: number) => OrnamentAnchor | undefined
  /** Get the anchor container (for attaching ornaments) */
  getAnchorContainer: () => THREE.Group | null
  /** Get the tree scene */
  getScene: () => THREE.Group | null
  /** Get diagnostics */
  getDiagnostics: () => TreeLoadResult['diagnostics'] | null
  /** Attach a mesh to an anchor */
  attachToAnchor: (index: number, mesh: THREE.Object3D) => boolean
  /** Detach all children from an anchor */
  detachFromAnchor: (index: number) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ChristmasTree = forwardRef<ChristmasTreeHandle, ChristmasTreeProps>(
  function ChristmasTree(
    {
      showAnchors = false,
      onLoad,
      onError,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = 1,
    },
    ref
  ) {
    const [loadResult, setLoadResult] = useState<TreeLoadResult | null>(null)
    const [error, setError] = useState<Error | null>(null)
    
    // Load the tree on mount
    useEffect(() => {
      let cancelled = false
      
      loadChristmasTree()
        .then((result) => {
          if (cancelled) return
          
          setLoadResult(result)
          
          // Log diagnostics in development
          if (import.meta.env.DEV) {
            logDiagnostics(result.diagnostics)
          }
          
          onLoad?.(result)
        })
        .catch((err) => {
          if (cancelled) return
          
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          console.error('[ChristmasTree] Failed to load:', error)
          onError?.(error)
        })
      
      return () => {
        cancelled = true
      }
    }, [onLoad, onError])
    
    // Create/update debug visualization
    useEffect(() => {
      if (!loadResult) return
      
      if (!showAnchors) {
        // Remove any existing debug visualization
        const existing = loadResult.scene.getObjectByName('AnchorDebugVisualization')
        if (existing) {
          existing.parent?.remove(existing)
        }
        return
      }
      
      // Remove any existing before adding new
      const existing = loadResult.scene.getObjectByName('AnchorDebugVisualization')
      if (existing) {
        existing.parent?.remove(existing)
      }
      
      const debug = createAnchorDebugVisualization(loadResult.anchors)
      loadResult.scene.add(debug)
      
      return () => {
        debug.parent?.remove(debug)
      }
    }, [loadResult, showAnchors])
    
    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      getAnchors: () => loadResult?.anchors ?? [],
      
      getAnchor: (index: number) => loadResult?.anchors[index],
      
      getAnchorContainer: () => loadResult?.anchorContainer ?? null,
      
      getScene: () => loadResult?.scene ?? null,
      
      getDiagnostics: () => loadResult?.diagnostics ?? null,
      
      attachToAnchor: (index: number, mesh: THREE.Object3D) => {
        if (!loadResult?.anchorContainer) return false
        
        const anchorObj = loadResult.anchorContainer.children[index]
        if (!anchorObj) return false
        
        anchorObj.add(mesh)
        return true
      },
      
      detachFromAnchor: (index: number) => {
        if (!loadResult?.anchorContainer) return
        
        const anchorObj = loadResult.anchorContainer.children[index]
        if (!anchorObj) return
        
        // Remove all children
        while (anchorObj.children.length > 0) {
          anchorObj.remove(anchorObj.children[0]!)
        }
      },
    }), [loadResult])
    
    // Loading state
    if (!loadResult) {
      if (error) {
        return null // Error already logged
      }
      return null // Still loading
    }
    
    return (
      <primitive
        object={loadResult.scene}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    )
  }
)