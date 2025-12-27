import { useEventStore } from '../stores/eventStore'
import { useToolStore } from '../stores/toolStore'

export function DebugPanel() {
  const { events, currentStroke, clearEvents } = useEventStore()
  const { tool } = useToolStore()
  
  const totalEvents = events.length + currentStroke.length
  
  return (
    <div style={styles.container}>
      <div style={styles.title}>🐛 Debug</div>
      
      <div style={styles.row}>
        <span style={styles.label}>Events:</span>
        <span style={styles.value}>{events.length} committed</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Current stroke:</span>
        <span style={styles.value}>{currentStroke.length} pending</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Total:</span>
        <span style={styles.value}>{totalEvents}</span>
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Tool:</span>
        <span style={{
          ...styles.value,
          color: tool === 'paint' ? '#4ade80' : '#f87171'
        }}>
          {tool}
        </span>
      </div>
      
      <div style={styles.buttons}>
        <button 
          style={styles.button}
          onClick={() => {
            // @ts-expect-error - debug function
            window.__drawball?.replayWithFlash()
          }}
        >
          🔄 Replay
        </button>
        
        <button 
          style={{ ...styles.button, background: '#991b1b' }}
          onClick={() => {
            // Clear both the event store AND the canvas
            clearEvents()
            // @ts-expect-error - debug function
            window.__drawball?.clearCanvas()
          }}
        >
          🗑️ Clear
        </button>
      </div>
      
      <div style={styles.hint}>
        Console: <code>__drawball.getEvents()</code>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 20,
    right: 20,
    padding: '12px 16px',
    background: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    fontSize: 13,
    color: '#e5e7eb',
    minWidth: 180,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid #374151',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: '#9ca3af',
  },
  value: {
    fontFamily: 'monospace',
    fontWeight: 500,
  },
  buttons: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    padding: '6px 10px',
    background: '#374151',
    border: 'none',
    borderRadius: 6,
    color: 'white',
    fontSize: 12,
    cursor: 'pointer',
  },
  hint: {
    marginTop: 10,
    fontSize: 10,
    color: '#6b7280',
  },
}
