/**
 * Christmas Tree Asset Loader & Ornament Anchor System
 * 
 * Loads a Christmas tree 3D model and converts decorative ball ornaments
 * into invisible anchor points for dynamic, interactive ornaments.
 * 
 * All manipulation happens at runtime - no DCC tool access required.
 */

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ============================================================================
// TYPES
// ============================================================================

export interface OrnamentAnchor {
  id: string
  index: number
  /** World position of the anchor */
  worldPosition: THREE.Vector3
  /** World quaternion of the anchor */
  worldQuaternion: THREE.Quaternion
  /** World scale of the anchor */
  worldScale: THREE.Vector3
  /** Local position relative to tree root */
  localPosition: THREE.Vector3
  /** Local quaternion relative to tree root */
  localQuaternion: THREE.Quaternion
  /** Local scale relative to tree root */
  localScale: THREE.Vector3
  /** Original mesh name (for debugging) */
  sourceMeshName: string
  /** Approximate radius of the original ornament */
  radius: number
}

export interface SceneGraphNode {
  name: string
  type: string
  uuid: string
  geometryId?: string
  materialIds?: string[]
  worldPosition: THREE.Vector3
  worldRotation: THREE.Euler
  worldScale: THREE.Vector3
  boundingBox?: THREE.Box3
  boundingBoxSize?: THREE.Vector3
  isOrnament: boolean
  ornamentConfidence: number
  detectionReasons: string[]
}

export interface TreeLoadResult {
  /** The processed tree scene (ornaments removed) */
  scene: THREE.Group
  /** Anchor points for ornaments */
  anchors: OrnamentAnchor[]
  /** Container node for all anchors */
  anchorContainer: THREE.Group
  /** Diagnostic info about the loading process */
  diagnostics: TreeDiagnostics
  /** Whether the asset is compatible (ornaments were separate meshes) */
  isCompatible: boolean
  /** Original GLTF data */
  gltf: GLTF
}

export interface TreeDiagnostics {
  totalMeshes: number
  totalNodes: number
  ornamentsDetected: number
  anchorsCreated: number
  detectionMethod: 'name' | 'geometry' | 'mixed' | 'none'
  warnings: string[]
  sceneGraph: SceneGraphNode[]
  originalScale: THREE.Vector3
  normalizedScale: number
  loadTimeMs: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_PATH = '/assets/models/christmas-tree/scene.gltf'

// Keywords for ornament detection (case-insensitive)
const ORNAMENT_NAME_KEYWORDS = [
  'ball', 'ornament', 'sphere', 'globe', 'glorb', 'bauble', 'decoration'
]

// Keywords to EXCLUDE (these are tree structure, not ornaments)
const EXCLUDE_KEYWORDS = [
  'base', 'trunk', 'leaf', 'branch', 'star', 'top', 'cone', 'tree'
]

// Geometry-based detection thresholds
const SPHERICAL_ASPECT_RATIO_TOLERANCE = 0.3 // 30% tolerance for sphere detection
const MIN_ORNAMENT_SIZE = 0.01 // Minimum size to be considered an ornament
const MAX_ORNAMENT_SIZE = 0.5 // Maximum size (larger = probably not an ornament)

// Normalization target (1 unit = 1 meter, tree should be ~2m tall)
const TARGET_TREE_HEIGHT = 2.0

// ============================================================================
// SCENE GRAPH INSPECTION
// ============================================================================

function inspectSceneGraph(scene: THREE.Object3D): SceneGraphNode[] {
  const nodes: SceneGraphNode[] = []
  
  scene.traverse((object) => {
    const node: SceneGraphNode = {
      name: object.name,
      type: object.type,
      uuid: object.uuid,
      worldPosition: new THREE.Vector3(),
      worldRotation: new THREE.Euler(),
      worldScale: new THREE.Vector3(),
      isOrnament: false,
      ornamentConfidence: 0,
      detectionReasons: [],
    }
    
    // Get world transforms
    object.getWorldPosition(node.worldPosition)
    const worldQuat = new THREE.Quaternion()
    object.getWorldQuaternion(worldQuat)
    node.worldRotation.setFromQuaternion(worldQuat)
    object.getWorldScale(node.worldScale)
    
    // If it's a mesh, get geometry and material info
    if (object instanceof THREE.Mesh) {
      node.geometryId = object.geometry?.uuid
      
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        node.materialIds = materials.map(m => m.uuid)
      }
      
      // Compute bounding box
      if (object.geometry) {
        object.geometry.computeBoundingBox()
        if (object.geometry.boundingBox) {
          node.boundingBox = object.geometry.boundingBox.clone()
          node.boundingBoxSize = new THREE.Vector3()
          object.geometry.boundingBox.getSize(node.boundingBoxSize)
        }
      }
      
      // Run ornament detection
      const detection = detectOrnament(object, node)
      node.isOrnament = detection.isOrnament
      node.ornamentConfidence = detection.confidence
      node.detectionReasons = detection.reasons
    }
    
    nodes.push(node)
  })
  
  return nodes
}

// ============================================================================
// ORNAMENT DETECTION
// ============================================================================

interface DetectionResult {
  isOrnament: boolean
  confidence: number
  reasons: string[]
}

function detectOrnament(mesh: THREE.Mesh, nodeInfo: SceneGraphNode): DetectionResult {
  const reasons: string[] = []
  let confidence = 0
  
  const nameLower = mesh.name.toLowerCase()
  
  // Check exclusion keywords first
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      return { isOrnament: false, confidence: 0, reasons: [`Excluded: name contains "${keyword}"`] }
    }
  }
  
  // Primary: Name-based detection
  for (const keyword of ORNAMENT_NAME_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      confidence += 0.5
      reasons.push(`Name contains "${keyword}"`)
    }
  }
  
  // Check material names too
  if (mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      const matNameLower = mat.name?.toLowerCase() || ''
      for (const keyword of ORNAMENT_NAME_KEYWORDS) {
        if (matNameLower.includes(keyword)) {
          confidence += 0.3
          reasons.push(`Material name contains "${keyword}"`)
        }
      }
    }
  }
  
  // Secondary: Geometry-based detection
  if (nodeInfo.boundingBoxSize) {
    const size = nodeInfo.boundingBoxSize
    const avgSize = (size.x + size.y + size.z) / 3
    
    // Check if roughly spherical (all dimensions similar)
    const maxDiff = Math.max(
      Math.abs(size.x - avgSize),
      Math.abs(size.y - avgSize),
      Math.abs(size.z - avgSize)
    )
    const aspectRatio = maxDiff / avgSize
    
    if (aspectRatio < SPHERICAL_ASPECT_RATIO_TOLERANCE) {
      confidence += 0.2
      reasons.push(`Roughly spherical (aspect ratio: ${aspectRatio.toFixed(2)})`)
    }
    
    // Check size range
    if (avgSize >= MIN_ORNAMENT_SIZE && avgSize <= MAX_ORNAMENT_SIZE) {
      confidence += 0.1
      reasons.push(`Size in ornament range (${avgSize.toFixed(3)})`)
    }
  }
  
  // Threshold: need at least 0.4 confidence
  const isOrnament = confidence >= 0.4
  
  return { isOrnament, confidence, reasons }
}

// ============================================================================
// TRANSFORM EXTRACTION
// ============================================================================

function extractOrnamentTransforms(
  mesh: THREE.Mesh,
  treeRoot: THREE.Object3D
): {
  worldPosition: THREE.Vector3
  worldQuaternion: THREE.Quaternion
  worldScale: THREE.Vector3
  localPosition: THREE.Vector3
  localQuaternion: THREE.Quaternion
  localScale: THREE.Vector3
  radius: number
} {
  // Get world transforms
  const worldPosition = new THREE.Vector3()
  const worldQuaternion = new THREE.Quaternion()
  const worldScale = new THREE.Vector3()
  
  mesh.getWorldPosition(worldPosition)
  mesh.getWorldQuaternion(worldQuaternion)
  mesh.getWorldScale(worldScale)
  
  // Convert to tree-local space
  const treeWorldMatrix = new THREE.Matrix4()
  treeRoot.updateWorldMatrix(true, false)
  treeWorldMatrix.copy(treeRoot.matrixWorld).invert()
  
  const localPosition = worldPosition.clone().applyMatrix4(treeWorldMatrix)
  
  // For rotation, we need to get the relative quaternion
  const treeWorldQuaternion = new THREE.Quaternion()
  treeRoot.getWorldQuaternion(treeWorldQuaternion)
  const localQuaternion = treeWorldQuaternion.clone().invert().multiply(worldQuaternion)
  
  // For scale, divide by tree's world scale
  const treeWorldScale = new THREE.Vector3()
  treeRoot.getWorldScale(treeWorldScale)
  const localScale = worldScale.clone().divide(treeWorldScale)
  
  // Estimate radius from bounding box
  let radius = 0.05 // Default
  if (mesh.geometry) {
    mesh.geometry.computeBoundingBox()
    if (mesh.geometry.boundingBox) {
      const size = new THREE.Vector3()
      mesh.geometry.boundingBox.getSize(size)
      radius = Math.max(size.x, size.y, size.z) / 2 * Math.max(worldScale.x, worldScale.y, worldScale.z)
    }
  }
  
  return {
    worldPosition,
    worldQuaternion,
    worldScale,
    localPosition,
    localQuaternion,
    localScale,
    radius,
  }
}

// ============================================================================
// ORNAMENT REMOVAL & ANCHOR CREATION
// ============================================================================

function removeOrnamentsAndCreateAnchors(
  scene: THREE.Group,
  sceneGraph: SceneGraphNode[],
  treeRoot: THREE.Object3D
): {
  anchors: OrnamentAnchor[]
  anchorContainer: THREE.Group
  removedCount: number
} {
  const anchors: OrnamentAnchor[] = []
  const anchorContainer = new THREE.Group()
  anchorContainer.name = 'OrnamentAnchors'
  
  // Find all ornament meshes
  const ornamentNodes = sceneGraph.filter(n => n.isOrnament)
  const meshesToRemove: THREE.Mesh[] = []
  
  // First pass: collect meshes and extract transforms
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    
    const nodeInfo = ornamentNodes.find(n => n.uuid === object.uuid)
    if (!nodeInfo) return
    
    // Extract transforms before removal
    const transforms = extractOrnamentTransforms(object, treeRoot)
    
    const anchor: OrnamentAnchor = {
      id: `anchor-${anchors.length}`,
      index: anchors.length,
      worldPosition: transforms.worldPosition,
      worldQuaternion: transforms.worldQuaternion,
      worldScale: transforms.worldScale,
      localPosition: transforms.localPosition,
      localQuaternion: transforms.localQuaternion,
      localScale: transforms.localScale,
      sourceMeshName: object.name,
      radius: transforms.radius,
    }
    
    anchors.push(anchor)
    meshesToRemove.push(object)
  })
  
  // Second pass: remove meshes
  for (const mesh of meshesToRemove) {
    // Dispose geometry and materials to free memory
    if (mesh.geometry) {
      mesh.geometry.dispose()
    }
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        mat.dispose()
      }
    }
    
    // Remove from parent
    if (mesh.parent) {
      mesh.parent.remove(mesh)
    }
  }
  
  // Third pass: create anchor objects
  for (const anchor of anchors) {
    const anchorObject = new THREE.Object3D()
    anchorObject.name = anchor.id
    anchorObject.position.copy(anchor.localPosition)
    anchorObject.quaternion.copy(anchor.localQuaternion)
    anchorObject.scale.copy(anchor.localScale)
    
    // Store anchor data in userData for easy access
    anchorObject.userData.anchor = anchor
    
    anchorContainer.add(anchorObject)
  }
  
  return {
    anchors,
    anchorContainer,
    removedCount: meshesToRemove.length,
  }
}

// ============================================================================
// TREE NORMALIZATION
// ============================================================================

function normalizeTree(scene: THREE.Group): { originalScale: THREE.Vector3; normalizedScale: number } {
  // Compute the bounding box of the entire tree
  const bbox = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  
  const originalScale = size.clone()
  
  // Calculate scale factor to achieve target height
  const currentHeight = size.y
  const scaleFactor = TARGET_TREE_HEIGHT / currentHeight
  
  // Apply uniform scale to the root
  scene.scale.multiplyScalar(scaleFactor)
  
  // Update matrices
  scene.updateMatrixWorld(true)
  
  // Center the tree horizontally (keep base at y=0)
  const newBbox = new THREE.Box3().setFromObject(scene)
  const center = new THREE.Vector3()
  newBbox.getCenter(center)
  
  scene.position.x -= center.x
  scene.position.z -= center.z
  scene.position.y -= newBbox.min.y // Put base at y=0
  
  scene.updateMatrixWorld(true)
  
  return { originalScale, normalizedScale: scaleFactor }
}

// ============================================================================
// MAIN LOADER
// ============================================================================

export async function loadChristmasTree(): Promise<TreeLoadResult> {
  const startTime = performance.now()
  const warnings: string[] = []
  
  // Load the GLTF
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(MODEL_PATH)
  
  const scene = gltf.scene as THREE.Group
  
  // Ensure all world matrices are up to date
  scene.updateWorldMatrix(true, true)
  
  // Step 1: Inspect scene graph
  const sceneGraph = inspectSceneGraph(scene)
  
  const totalMeshes = sceneGraph.filter(n => n.type === 'Mesh').length
  const totalNodes = sceneGraph.length
  const ornamentsDetected = sceneGraph.filter(n => n.isOrnament).length
  
  console.log(`[ChristmasTree] Scene inspection complete:`)
  console.log(`  - Total nodes: ${totalNodes}`)
  console.log(`  - Total meshes: ${totalMeshes}`)
  console.log(`  - Ornaments detected: ${ornamentsDetected}`)
  
  // Step 2: Validate - check if ornaments are separate meshes
  const ornamentNodes = sceneGraph.filter(n => n.isOrnament)
  const isCompatible = ornamentNodes.length > 0
  
  if (!isCompatible) {
    warnings.push('No ornaments detected - asset may have baked geometry or different naming convention')
  }
  
  // Log detection details
  for (const node of ornamentNodes) {
    console.log(`  [Ornament] ${node.name} (confidence: ${node.ornamentConfidence.toFixed(2)})`)
    for (const reason of node.detectionReasons) {
      console.log(`    - ${reason}`)
    }
  }
  
  // Determine detection method
  let detectionMethod: 'name' | 'geometry' | 'mixed' | 'none' = 'none'
  if (ornamentsDetected > 0) {
    const hasNameDetection = ornamentNodes.some(n => 
      n.detectionReasons.some(r => r.includes('Name contains') || r.includes('Material name'))
    )
    const hasGeometryDetection = ornamentNodes.some(n =>
      n.detectionReasons.some(r => r.includes('spherical') || r.includes('Size in'))
    )
    
    if (hasNameDetection && hasGeometryDetection) {
      detectionMethod = 'mixed'
    } else if (hasNameDetection) {
      detectionMethod = 'name'
    } else if (hasGeometryDetection) {
      detectionMethod = 'geometry'
    }
  }
  
  // Step 3: Normalize tree scale (do this BEFORE extracting transforms)
  const { originalScale, normalizedScale } = normalizeTree(scene)
  
  // Step 4: Remove ornaments and create anchors
  const { anchors, anchorContainer, removedCount } = removeOrnamentsAndCreateAnchors(
    scene,
    sceneGraph,
    scene
  )
  
  // Add anchor container to scene
  scene.add(anchorContainer)
  
  if (removedCount !== ornamentsDetected) {
    warnings.push(`Removed ${removedCount} meshes but detected ${ornamentsDetected} ornaments`)
  }
  
  const loadTimeMs = performance.now() - startTime
  
  console.log(`[ChristmasTree] Processing complete in ${loadTimeMs.toFixed(1)}ms:`)
  console.log(`  - Anchors created: ${anchors.length}`)
  console.log(`  - Tree normalized to ${TARGET_TREE_HEIGHT}m height`)
  console.log(`  - Original scale: ${originalScale.toArray().map(v => v.toFixed(3)).join(', ')}`)
  
  if (warnings.length > 0) {
    console.warn(`[ChristmasTree] Warnings:`)
    for (const warning of warnings) {
      console.warn(`  - ${warning}`)
    }
  }
  
  return {
    scene,
    anchors,
    anchorContainer,
    diagnostics: {
      totalMeshes,
      totalNodes,
      ornamentsDetected,
      anchorsCreated: anchors.length,
      detectionMethod,
      warnings,
      sceneGraph,
      originalScale,
      normalizedScale,
      loadTimeMs,
    },
    isCompatible,
    gltf,
  }
}

// ============================================================================
// DEBUG VISUALIZATION
// ============================================================================

/**
 * Creates debug visualization for anchor points (wireframe spheres)
 * Only use in development!
 */
export function createAnchorDebugVisualization(anchors: OrnamentAnchor[]): THREE.Group {
  const debugGroup = new THREE.Group()
  debugGroup.name = 'AnchorDebugVisualization'
  
  const sphereGeometry = new THREE.SphereGeometry(1, 8, 6)
  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
  })
  
  for (const anchor of anchors) {
    const sphere = new THREE.Mesh(sphereGeometry, wireframeMaterial)
    sphere.position.copy(anchor.localPosition)
    sphere.quaternion.copy(anchor.localQuaternion)
    sphere.scale.setScalar(anchor.radius * 2) // Diameter
    sphere.name = `debug-${anchor.id}`
    
    debugGroup.add(sphere)
  }
  
  return debugGroup
}

/**
 * Logs a detailed diagnostic summary to the console
 */
export function logDiagnostics(diagnostics: TreeDiagnostics): void {
  console.group('🎄 Christmas Tree Diagnostics')
  
  console.log(`Load time: ${diagnostics.loadTimeMs.toFixed(1)}ms`)
  console.log(`Total nodes: ${diagnostics.totalNodes}`)
  console.log(`Total meshes: ${diagnostics.totalMeshes}`)
  console.log(`Ornaments detected: ${diagnostics.ornamentsDetected}`)
  console.log(`Anchors created: ${diagnostics.anchorsCreated}`)
  console.log(`Detection method: ${diagnostics.detectionMethod}`)
  console.log(`Normalized scale factor: ${diagnostics.normalizedScale.toFixed(4)}`)
  
  if (diagnostics.warnings.length > 0) {
    console.group('⚠️ Warnings')
    for (const warning of diagnostics.warnings) {
      console.warn(warning)
    }
    console.groupEnd()
  }
  
  console.group('📊 Scene Graph (ornaments only)')
  const ornaments = diagnostics.sceneGraph.filter(n => n.isOrnament)
  for (const node of ornaments) {
    console.log(`${node.name}: confidence=${node.ornamentConfidence.toFixed(2)}, reasons=[${node.detectionReasons.join(', ')}]`)
  }
  console.groupEnd()
  
  console.groupEnd()
}
