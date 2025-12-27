import { useToolStore } from '../stores/toolStore'

export function Toolbar() {
  const { tool, brushColor, brushSize, colors, sizes, setBrushColor, setBrushSize } = useToolStore()

  return (
    <div style={styles.container}>
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
        <div style={styles.label}>Size</div>
        <div style={styles.sizeRow}>
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              style={{
                ...styles.sizeButton,
                border: brushSize === size ? '2px solid white' : '2px solid #4b5563',
              }}
            >
              <div style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: brushColor,
              }} />
            </button>
          ))}
        </div>
      </div>
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
  sizeRow: {
    display: 'flex',
    gap: 8,
  },
  sizeButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    background: '#1f2937',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
}
