import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProjectsView } from './components/ProjectsView'
import { PaintingView } from './components/PaintingView'
import { JoinSessionView } from './components/JoinSessionView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsView />} />
        <Route path="/join/:sessionId" element={<JoinSessionView />} />
        <Route path="/:projectId" element={<PaintingView />} />
      </Routes>
    </BrowserRouter>
  )
}
