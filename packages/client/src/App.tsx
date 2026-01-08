import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProjectsView } from './components/ProjectsView'
import { PaintingView } from './components/PaintingView'
import { JoinSessionView } from './components/JoinSessionView'
import { ChristmasTreeDemo } from './components/ChristmasTreeDemo'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsView />} />
        <Route path="/tree-demo" element={<ChristmasTreeDemo />} />
        <Route path="/join/:sessionId" element={<JoinSessionView />} />
        <Route path="/:projectId" element={<PaintingView />} />
      </Routes>
    </BrowserRouter>
  )
}
