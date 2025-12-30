import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProjectsView } from './components/ProjectsView'
import { PaintingView } from './components/PaintingView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsView />} />
        <Route path="/:projectId" element={<PaintingView />} />
      </Routes>
    </BrowserRouter>
  )
}
