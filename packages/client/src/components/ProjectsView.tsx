import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../stores/projectStore'
import { TreeScene } from './TreeScene'
import type { ProjectMeta } from '../lib/projectStorage'

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, isLoading, loadProjects, createProject, renameProject, deleteProject } = useProjectStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [maxOrnaments, setMaxOrnaments] = useState<number>(0)

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

  // Count projects with textures (those that appear on tree)
  const projectsWithTextures = projects.filter(p => p.textureData || p.thumbnail)
  const displayedOnTree = Math.min(projectsWithTextures.length, maxOrnaments)

  // Fun messages based on ball count
  const getTreeMessage = () => {
    if (projectsWithTextures.length === 0) {
      return "🎄 Your tree is empty! Create your first ball to decorate it!"
    }
    if (displayedOnTree < maxOrnaments) {
      return `🎨 ${displayedOnTree} ball${displayedOnTree !== 1 ? 's' : ''} on the tree • ${maxOrnaments - displayedOnTree} spots left!`
    }
    return `✨ ${displayedOnTree} / ${maxOrnaments} ornaments • Tree is fully decorated!`
  }

  return (
    <div style={styles.container}>
      {/* Left sidebar - Projects list */}
      <aside style={styles.sidebar}>
        <header style={styles.header}>
          <h1 style={styles.title}>🎨 DrawBall</h1>
          <p style={styles.subtitle}>Paint 3D balls</p>
        </header>

        {/* Create New button */}
        <button 
          onClick={handleCreateNew}
          style={styles.newButton}
        >
          <span style={styles.newIcon}>+</span>
          <span>New Ball</span>
        </button>

        {/* Projects list */}
        <div style={styles.projectsSection}>
          <h2 style={styles.sectionTitle}>Recent Projects</h2>
          
          {isLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : projects.length === 0 ? (
            <div style={styles.emptyState}>
              No projects yet.<br />
              Create your first ball!
            </div>
          ) : (
            <div style={styles.projectsList}>
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleOpenProject(project.id)}
                  style={styles.projectItem}
                >
                  {/* Mini thumbnail */}
                  <div style={styles.miniThumb}>
                    {project.thumbnail ? (
                      <img 
                        src={project.thumbnail} 
                        alt=""
                        style={styles.miniThumbImage}
                      />
                    ) : (
                      <span style={styles.miniThumbPlaceholder}>🎱</span>
                    )}
                  </div>
                  
                  <div style={styles.projectItemInfo}>
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
                      <div style={styles.projectItemName}>{project.name}</div>
                    )}
                    <div style={styles.projectItemDate}>{formatDate(project.updatedAt)}</div>
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
        </div>
      </aside>

      {/* Right side - Tree scene */}
      <main style={styles.treeContainer}>
        {/* Tree message */}
        <div style={styles.treeMessage}>
          {getTreeMessage()}
        </div>
        
        {/* 3D Tree Scene */}
        <div style={styles.canvasContainer}>
          <TreeScene 
            projects={projects} 
            onLoad={setMaxOrnaments}
          />
        </div>
      </main>
    </div>
  )
}

const SIDEBAR_WIDTH = 280

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    overflow: 'hidden',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    overflowY: 'auto',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  newButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
    marginBottom: 24,
  },
  newIcon: {
    fontSize: 20,
    fontWeight: 700,
  },
  projectsSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  loading: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    padding: 20,
    textAlign: 'center',
  },
  emptyState: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    padding: 20,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  projectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
    flex: 1,
  },
  projectItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  miniThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  miniThumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  miniThumbPlaceholder: {
    fontSize: 20,
    opacity: 0.4,
  },
  projectItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  projectItemName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  projectItemDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  renameInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: 14,
    fontWeight: 500,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    color: '#fff',
    outline: 'none',
  },
  menuButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
  },
  contextMenu: {
    position: 'absolute',
    top: '100%',
    right: 8,
    marginTop: 4,
    background: 'rgba(17, 24, 39, 0.98)',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    zIndex: 10,
    minWidth: 130,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuItemDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  treeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  treeMessage: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    background: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    zIndex: 10,
    backdropFilter: 'blur(10px)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
  },
}
