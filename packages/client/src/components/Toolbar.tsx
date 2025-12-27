import { useToolStore, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE } from '../stores/toolStore'
// Hidden: undo/redo
// import { useEventStore } from '../stores/eventStore'
// import { useSessionStore } from '../stores/sessionStore'

export function Toolbar() {
  const { tool, brushColor, brushSize, colors, setBrushColor, setBrushSize } = useToolStore()
  // Hidden: undo/redo and rotation mode toggle
  // const { undo, redo, canUndo, canRedo } = useEventStore()
  // const { rotationMode, toggleRotationMode } = useToolStore()
  // const { currentUser } = useSessionStore()
  // const userId = currentUser?.id ?? 'local-user'

  /* Hidden: undo/redo handlers - revisiting later
  const handleUndo = () => {
    if (canUndoNow && !isInSession) {
      undo(userId)
    }
  }
  
  const handleRedo = () => {
    if (canRedoNow && !isInSession) {
      redo(userId)
    }
  }
  */

  return (
    <div style={styles.container}>
      {/* Undo/Redo buttons - hidden for now, revisiting later
      {!isInSession && (
        <div style={styles.section}>
          <div style={styles.label}>History</div>
          <div style={styles.historyRow}>
            <button
              onClick={handleUndo}
              disabled={!canUndoNow}
              style={{
                ...styles.historyButton,
                opacity: canUndoNow ? 1 : 0.4,
                cursor: canUndoNow ? 'pointer' : 'not-allowed',
              }}
              title="Undo (Ctrl+Z)"
            >
              ↩️
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedoNow}
              style={{
                ...styles.historyButton,
                opacity: canRedoNow ? 1 : 0.4,
                cursor: canRedoNow ? 'pointer' : 'not-allowed',
              }}
              title="Redo (Ctrl+Y)"
            >
              ↪️
            </button>
          </div>
        </div>
      )}
      */}
      
      {/* Tool indicator */}
      <div style={styles.section}>
        <div style={styles.label}>Tool</div>
        <div style={{
          ...styles.toolIndicator,
          background: tool === 'paint' ? brushColor : '#6b7280',
        }}>
          {tool === 'paint' ? '🖌️ Paint' : '🧹 Erase'}
        </div>
        <div style={styles.hint}>Middle-click to toggle</div>
      </div>

      {/* Color picker */}
      <div style={styles.section}>
        <div style={styles.label}>Color</div>
        <div style={styles.colorGrid}>
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setBrushColor(color)}
              style={{
                ...styles.colorButton,
                background: color,
                border: brushColor === color ? '3px solid white' : '2px solid transparent',
                transform: brushColor === color ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Brush size */}
      <div style={styles.section}>
        <div style={styles.label}>Size: {brushSize}px</div>
        <input
          type="range"
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          style={styles.sizeSlider}
        />
        <div style={styles.sizePreviewContainer}>
          <div style={{
            width: Math.min(brushSize, 40),
            height: Math.min(brushSize, 40),
            borderRadius: '50%',
            background: brushColor,
          }} />
        </div>
      </div>

      {/* Rotation mode toggle - hidden for now, will revisit later
      <div style={styles.section}>
        <div style={styles.label}>Rotate</div>
        <button
          onClick={toggleRotationMode}
          style={styles.rotationButton}
          title={rotationMode === 'ball' ? 'Ball rotation (shadows move)' : 'Camera rotation (shadows fixed)'}
        >
          {rotationMode === 'ball' ? '🎱 Ball' : '📷 Camera'}
        </button>
      </div>
      */}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 24,
    padding: '16px 24px',
    background: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toolIndicator: {
    padding: '8px 16px',
    borderRadius: 8,
    color: 'white',
    fontWeight: 600,
    fontSize: 14,
  },
  hint: {
    fontSize: 10,
    color: '#6b7280',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
  },
  colorButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sizeSlider: {
    width: 100,
    height: 6,
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  sizePreviewContainer: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    display: 'flex',
    gap: 8,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: '#1f2937',
    border: '2px solid #4b5563',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  rotationButton: {
    padding: '8px 12px',
    borderRadius: 8,
    background: '#1f2937',
    border: '2px solid #4b5563',
    color: 'white',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
}
