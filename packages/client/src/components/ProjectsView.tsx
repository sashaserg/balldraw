import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../stores/projectStore'
import type { ProjectMeta } from '../lib/projectStorage'

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, isLoading, loadProjects, createProject, renameProject, deleteProject } = useProjectStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreateNew = async () => {
    const project = await createProject()
    navigate(`/${project.id}`)
  }

  const handleOpenProject = (id: string) => {
    if (editingId) return // Don't navigate while editing
    navigate(`/${id}`)
  }

  const handleStartRename = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation()
    setEditingId(project.id)
    setEditName(project.name)
    setMenuOpenId(null)
  }

  const handleSaveRename = async () => {
    if (editingId && editName.trim()) {
      await renameProject(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const handleCancelRename = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setMenuOpenId(null)
    if (confirm('Delete this project?')) {
      await deleteProject(id)
    }
  }

  const handleMenuToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === id ? null : id)
  }

  // Close menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setMenuOpenId(null)
    if (menuOpenId) {
      window.addEventListener('click', handleClick)
      return () => window.removeEventListener('click', handleClick)
    }
  }, [menuOpenId])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎨 DrawBall</h1>
        <p style={styles.subtitle}>Collaborative 3D painting</p>
      </header>

      <main style={styles.main}>
        <h2 style={styles.sectionTitle}>Projects</h2>
        
        {isLoading ? (
          <div style={styles.loading}>Loading projects...</div>
        ) : (
          <div style={styles.grid}>
            {/* Create New button */}
            <button 
              onClick={handleCreateNew}
              style={styles.newCard}
            >
              <span style={styles.newIcon}>+</span>
              <span style={styles.newLabel}>New Project</span>
            </button>

            {/* Existing projects */}
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                style={styles.projectCard}
              >
                {/* Thumbnail */}
                <div style={styles.thumbnail}>
                  {project.thumbnail ? (
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      style={styles.thumbnailImage}
                    />
                  ) : (
                    <span style={styles.thumbnailPlaceholder}>🎱</span>
                  )}
                </div>
                
                <div style={styles.projectInfo}>
                  {editingId === project.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename()
                        if (e.key === 'Escape') handleCancelRename()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={styles.renameInput}
                    />
                  ) : (
                    <div style={styles.projectName}>{project.name}</div>
                  )}
                  <div style={styles.projectDate}>{formatDate(project.updatedAt)}</div>
                </div>

                {/* Context menu button */}
                <button
                  onClick={(e) => handleMenuToggle(e, project.id)}
                  style={styles.menuButton}
                >
                  ⋮
                </button>

                {/* Context menu */}
                {menuOpenId === project.id && (
                  <div style={styles.contextMenu} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleStartRename(e, project)}
                      style={styles.menuItem}
                    >
                      ✏️ Rename
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      style={styles.menuItemDanger}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: 40,
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 24,
  },
  loading: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    padding: 40,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 24,
  },
  newCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: '1',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  newIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  newLabel: {
    fontSize: 16,
    fontWeight: 500,
  },
  projectCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  thumbnail: {
    aspectRatio: '1',
    background: 'rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailPlaceholder: {
    fontSize: 64,
    opacity: 0.3,
  },
  projectInfo: {
    padding: 16,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  projectDate: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  renameInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: 16,
    fontWeight: 600,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    color: '#fff',
    outline: 'none',
    marginBottom: 4,
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  contextMenu: {
    position: 'absolute',
    top: 44,
    right: 8,
    background: 'rgba(17, 24, 39, 0.98)',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    zIndex: 10,
    minWidth: 140,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuItemDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
