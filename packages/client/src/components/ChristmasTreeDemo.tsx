/**
 * Christmas Tree Demo Scene
 * 
 * A demo scene for testing the Christmas tree loader and ornament anchors.
 * This is a standalone scene separate from the main DrawBall painting functionality.
 */

import { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ChristmasTree, type ChristmasTreeHandle } from './ChristmasTree'
import type { TreeLoadResult } from '../lib/christmasTree'

export function ChristmasTreeDemo() {
  const treeRef = useRef<ChristmasTreeHandle>(null)
  const [treeData, setTreeData] = useState<TreeLoadResult | null>(null)
  const [showAnchors, setShowAnchors] = useState(true)
  
  const handleTreeLoad = (result: TreeLoadResult) => {
    setTreeData(result)
    console.log('Tree loaded!', result)
  }
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e' }}>
      {/* Controls Panel */}
      <div style={styles.panel}>
        <h2 style={styles.title}>🎄 Christmas Tree Demo</h2>
        
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showAnchors}
            onChange={(e) => setShowAnchors(e.target.checked)}
          />
          Show Anchor Points
        </label>
        
        {treeData && (
          <div style={styles.stats}>
            <div>Meshes: {treeData.diagnostics.totalMeshes}</div>
            <div>Ornaments Detected: {treeData.diagnostics.ornamentsDetected}</div>
            <div>Anchors Created: {treeData.diagnostics.anchorsCreated}</div>
            <div>Detection Method: {treeData.diagnostics.detectionMethod}</div>
            <div>Load Time: {treeData.diagnostics.loadTimeMs.toFixed(1)}ms</div>
            <div>Compatible: {treeData.isCompatible ? '✅' : '❌'}</div>
            
            {treeData.diagnostics.warnings.length > 0 && (
              <div style={styles.warnings}>
                <strong>Warnings:</strong>
                {treeData.diagnostics.warnings.map((w, i) => (
                  <div key={i}>⚠️ {w}</div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {treeData && (
          <div style={styles.anchorList}>
            <strong>Anchors ({treeData.anchors.length}):</strong>
            <div style={styles.anchorScroll}>
              {treeData.anchors.map((anchor) => (
                <div key={anchor.id} style={styles.anchorItem}>
                  <span>{anchor.id}</span>
                  <span style={styles.anchorDetail}>
                    r={anchor.radius.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 3D Scene */}
      <Canvas
        camera={{ position: [3, 2, 3], fov: 50 }}
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
      >
        <Suspense fallback={null}>
          <ChristmasTree
            ref={treeRef}
            showAnchors={showAnchors}
            onLoad={handleTreeLoad}
            position={[0, 0, 0]}
          />
        </Suspense>
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        
        {/* Controls */}
        <OrbitControls
          minDistance={1}
          maxDistance={10}
          target={[0, 1, 0]}
        />
        
        {/* Ground plane for reference */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#2d3748" />
        </mesh>
      </Canvas>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 16,
    left: 16,
    padding: 16,
    background: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    color: 'white',
    fontSize: 13,
    zIndex: 100,
    maxWidth: 280,
    backdropFilter: 'blur(10px)',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 16,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    marginBottom: 12,
  },
  stats: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 12,
  },
  warnings: {
    marginTop: 8,
    padding: 8,
    background: 'rgba(255,200,0,0.1)',
    borderRadius: 4,
    fontSize: 11,
  },
  anchorList: {
    fontSize: 11,
  },
  anchorScroll: {
    maxHeight: 200,
    overflowY: 'auto',
    marginTop: 8,
    padding: 4,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
  },
  anchorItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 4px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  anchorDetail: {
    color: 'rgba(255,255,255,0.5)',
  },
}
