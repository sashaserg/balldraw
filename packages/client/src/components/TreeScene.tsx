/**
 * TreeScene Component
 * 
 * A 3D scene showing the Christmas tree with project ornaments.
 * Used on the projects view page.
 */

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { TreeWithOrnaments } from './TreeWithOrnaments'
import type { ProjectMeta } from '../lib/projectStorage'

interface TreeSceneProps {
  /** Projects to display as ornaments */
  projects: ProjectMeta[]
  /** Called when tree loads with anchor count */
  onLoad?: (maxOrnaments: number) => void
}

export function TreeScene({ projects, onLoad }: TreeSceneProps) {
  return (
    <Canvas
      camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <TreeWithOrnaments projects={projects} onLoad={onLoad} />
      </Suspense>
      
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-3, 5, -3]} intensity={0.3} />
      
      {/* Controls - allow rotation but no zoom */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={2}
        maxDistance={5}
        target={[0, 1, 0]}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  )
}
