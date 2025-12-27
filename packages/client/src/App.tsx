import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { Toolbar } from './components/Toolbar'

export default function App() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Scene />
      </Canvas>
      <Toolbar />
    </>
  )
}
