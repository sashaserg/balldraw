/**
 * TreeWithOrnaments Component
 * 
 * Renders the Christmas tree with project balls as ornaments.
 * Distributes projects across available anchor points.
 */

import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { ChristmasTree, type ChristmasTreeHandle } from './ChristmasTree'
import type { TreeLoadResult, OrnamentAnchor } from '../lib/christmasTree'
import type { ProjectMeta } from '../lib/projectStorage'

const ORNAMENT_TEXTURE_SIZE = 256

// Cache textures to prevent recreation
const textureCache = new Map<string, THREE.CanvasTexture>()

// Create a texture from a thumbnail data URL (cached)
function createThumbnailTexture(thumbnail: string): THREE.CanvasTexture {
  // Check cache first
  const cached = textureCache.get(thumbnail)
  if (cached) return cached
  
  const canvas = document.createElement('canvas')
  canvas.width = ORNAMENT_TEXTURE_SIZE
  canvas.height = ORNAMENT_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!
  
  // Fill with placeholder color
  ctx.fillStyle = '#888888'
  ctx.fillRect(0, 0, ORNAMENT_TEXTURE_SIZE, ORNAMENT_TEXTURE_SIZE)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  
  // Cache the texture immediately
  textureCache.set(thumbnail, texture)
  
  // Load the thumbnail image asynchronously
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    ctx.drawImage(img, 0, 0, ORNAMENT_TEXTURE_SIZE, ORNAMENT_TEXTURE_SIZE)
    texture.needsUpdate = true
  }
  img.src = thumbnail
  
  return texture
}

// Seeded random for consistent anchor ordering
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

// Filter out anchors that are too low (on trunk/base)
const MIN_ORNAMENT_HEIGHT = 0.15 // Minimum height for valid ornament position (tree is 2m tall)

function filterValidAnchors(anchors: OrnamentAnchor[]): OrnamentAnchor[] {
  return anchors.filter(anchor => {
    // Filter out anchors too close to the ground (trunk area)
    return anchor.localPosition.y > MIN_ORNAMENT_HEIGHT
  })
}

// Generate a shuffled order for anchors (consistent based on seed)
function shuffleAnchors(anchors: OrnamentAnchor[], seed: number = 42): OrnamentAnchor[] {
  const random = seededRandom(seed)
  const shuffled = [...anchors]
  
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  
  return shuffled
}

interface TreeWithOrnamentsProps {
  /** Projects to display as ornaments (most recent first) */
  projects: ProjectMeta[]
  /** Called when tree loads with anchor count */
  onLoad?: (maxOrnaments: number) => void
}

export function TreeWithOrnaments({ projects, onLoad }: TreeWithOrnamentsProps) {
  const treeRef = useRef<ChristmasTreeHandle>(null)
  const [treeData, setTreeData] = useState<TreeLoadResult | null>(null)
  const [shuffledAnchors, setShuffledAnchors] = useState<OrnamentAnchor[]>([])
  
  const handleTreeLoad = (result: TreeLoadResult) => {
    setTreeData(result)
    
    // Filter out trunk anchors, then shuffle with fixed seed
    const validAnchors = filterValidAnchors(result.anchors)
    const shuffled = shuffleAnchors(validAnchors, 42)
    setShuffledAnchors(shuffled)
    
    onLoad?.(validAnchors.length)
  }
  
  // Get projects that have texture data (for proper sphere mapping)
  // Fall back to thumbnail for older projects
  const projectsWithTextures = useMemo(() => {
    return projects.filter(p => p.textureData || p.thumbnail)
  }, [projects])
  
  // Match projects to anchors
  const ornamentAssignments = useMemo(() => {
    if (!shuffledAnchors.length) return []
    
    // Take as many projects as we have anchors
    const maxOrnaments = shuffledAnchors.length
    const projectsToShow = projectsWithTextures.slice(0, maxOrnaments)
    
    return projectsToShow.map((project, index) => ({
      project,
      anchor: shuffledAnchors[index]!,
    }))
  }, [projectsWithTextures, shuffledAnchors])
  
  // Create and attach ornament spheres imperatively to the tree scene
  useEffect(() => {
    if (!treeData || !treeRef.current) return
    
    const scene = treeRef.current.getScene()
    if (!scene) return
    
    // Find or create ornaments group
    let ornamentsGroup = scene.getObjectByName('UserOrnaments') as THREE.Group | undefined
    if (!ornamentsGroup) {
      ornamentsGroup = new THREE.Group()
      ornamentsGroup.name = 'UserOrnaments'
      scene.add(ornamentsGroup)
    }
    
    // Track which ornaments we need
    const neededOrnaments = new Set(ornamentAssignments.map(a => a.project.id))
    
    // Remove ornaments that are no longer needed
    const toRemove: THREE.Object3D[] = []
    for (const child of ornamentsGroup.children) {
      const projectId = child.name.replace('ornament-', '')
      if (!neededOrnaments.has(projectId)) {
        toRemove.push(child)
      }
    }
    for (const child of toRemove) {
      ornamentsGroup.remove(child)
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    }
    
    // Build set of existing ornament IDs
    const existingOrnaments = new Set(
      ornamentsGroup.children.map(c => c.name.replace('ornament-', ''))
    )
    
    // Add ornament spheres for each assignment (only if not already in scene)
    for (const { project, anchor } of ornamentAssignments) {
      // Use textureData if available, fall back to thumbnail
      const textureSource = project.textureData || project.thumbnail
      if (!textureSource) continue
      if (existingOrnaments.has(project.id)) continue // Already exists in scene
      
      // Create sphere with texture
      const geometry = new THREE.SphereGeometry(1, 32, 32)
      const texture = createThumbnailTexture(textureSource)
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.1,
      })
      
      const sphere = new THREE.Mesh(geometry, material)
      sphere.name = `ornament-${project.id}`
      
      // Position at anchor's local position (relative to tree scene)
      sphere.position.copy(anchor.localPosition)
      sphere.scale.setScalar(Math.max(anchor.radius * 2, 0.08))
      
      ornamentsGroup.add(sphere)
    }
  }, [treeData, ornamentAssignments])
  
  return (
    <ChristmasTree
      ref={treeRef}
      showAnchors={false}
      onLoad={handleTreeLoad}
      position={[0, 0, 0]}
    />
  )
}
