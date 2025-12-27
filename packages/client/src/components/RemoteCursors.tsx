import { useCursorStore } from '../stores/cursorStore'

/**
 * 2D overlay that displays remote user cursors.
 * Renders as HTML positioned over the canvas working area.
 * Cursors are hidden while users are actively drawing.
 */
export function RemoteCursors() {
  const cursors = useCursorStore((state) => state.cursors)
  
  const cursorElements: JSX.Element[] = []
  
  cursors.forEach((cursor) => {
    // Don't show cursor if no position or if user is currently drawing
    if (!cursor.position || cursor.isDrawing) return
    
    // Convert normalized position (0-1) to percentage
    const left = `${cursor.position.x * 100}%`
    const top = `${cursor.position.y * 100}%`
    
    cursorElements.push(
      <div
        key={cursor.userId}
        style={{
          position: 'absolute',
          left,
          top,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Cursor pointer */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
        >
          <path
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.76a.5.5 0 0 0-.85.45Z"
            fill={cursor.color}
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>
        
        {/* User name label */}
        <div
          style={{
            background: cursor.color,
            color: 'white',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {cursor.userName}
        </div>
      </div>
    )
  })
  
  return <>{cursorElements}</>
}
