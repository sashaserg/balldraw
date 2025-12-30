import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

export function SessionPanel() {
  const { 
    sessionId, 
    isInSession, 
    currentUser, 
    users, 
    status, 
    error,
    createSession, 
    joinSession, 
    leaveSession 
  } = useSessionStore()
  
  const [userName, setUserName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)
  
  // Check for session ID in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionFromUrl = params.get('session')
    
    if (sessionFromUrl && !isInSession) {
      setJoinId(sessionFromUrl)
      setShowJoinForm(true)
      
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [isInSession])
  
  const handleCreate = async () => {
    if (!userName.trim()) return
    await createSession(userName.trim())
  }
  
  const handleJoin = async () => {
    if (!userName.trim() || !joinId.trim()) return
    await joinSession(joinId.trim(), userName.trim())
  }
  
  const copyLink = () => {
    const url = `${window.location.origin}/join/${sessionId}`
    navigator.clipboard.writeText(url)
  }
  
  // Get status dot color based on connection status
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4ade80'
      case 'connecting': return '#fbbf24'
      case 'error': return '#ef4444'
      default: return '#6b7280'
    }
  }
  
  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection Error'
      default: return 'Disconnected'
    }
  }
  
  // If in session, show session info
  if (isInSession) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={{ ...styles.statusDot, background: getStatusColor(), boxShadow: `0 0 8px ${getStatusColor()}` }} />
          <span style={styles.title}>{getStatusText()}</span>
        </div>
        
        <div style={styles.sessionId}>
          <span style={styles.label}>ID:</span>
          <code style={styles.code}>{sessionId}</code>
          <button style={styles.copyBtn} onClick={copyLink} title="Copy invite link">
            📋
          </button>
        </div>
        
        <div style={styles.section}>
          <div style={styles.label}>Users ({users.length}/4)</div>
          <div style={styles.userList}>
            {users.map((user) => (
              <div 
                key={user.id} 
                style={{
                  ...styles.userChip,
                  borderColor: user.color,
                  background: user.id === currentUser?.id ? `${user.color}33` : 'transparent',
                }}
              >
                <span style={{ ...styles.userDot, background: user.color }} />
                <span>{user.name}</span>
                {user.id === currentUser?.id && <span style={styles.youTag}>(you)</span>}
              </div>
            ))}
          </div>
        </div>
        
        <button style={styles.leaveBtn} onClick={leaveSession}>
          Leave Session
        </button>
      </div>
    )
  }
  
  // Not in session - show create/join options
  return (
    <div style={styles.container}>
      <div style={styles.title}>🎄 DrawBall</div>
      
      {error && (
        <div style={styles.error}>{error}</div>
      )}
      
      <div style={styles.section}>
        <input
          style={styles.input}
          placeholder="Your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          maxLength={20}
        />
      </div>
      
      {!showJoinForm ? (
        <>
          <button 
            style={styles.primaryBtn} 
            onClick={handleCreate}
            disabled={!userName.trim() || status === 'connecting'}
          >
            {status === 'connecting' ? 'Creating...' : 'Create Session'}
          </button>
          
          <div style={styles.divider}>
            <span>or</span>
          </div>
          
          <button 
            style={styles.secondaryBtn} 
            onClick={() => setShowJoinForm(true)}
          >
            Join Existing
          </button>
        </>
      ) : (
        <>
          <input
            style={styles.input}
            placeholder="Session ID"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
          />
          
          <div style={styles.buttonRow}>
            <button 
              style={styles.secondaryBtn} 
              onClick={() => setShowJoinForm(false)}
            >
              Back
            </button>
            <button 
              style={styles.primaryBtn} 
              onClick={handleJoin}
              disabled={!userName.trim() || !joinId.trim() || status === 'connecting'}
            >
              {status === 'connecting' ? 'Joining...' : 'Join'}
            </button>
          </div>
        </>
      )}
      
      <div style={styles.hint}>
        Paint solo or create a session to collaborate!
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 20,
    left: 20,
    padding: '16px',
    background: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    fontSize: 14,
    color: '#e5e7eb',
    minWidth: 220,
    maxWidth: 280,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 8px #4ade80',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  sessionId: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#60a5fa',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: 4,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    border: '1px solid',
    borderRadius: 6,
    fontSize: 13,
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  youTag: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid #374151',
    borderRadius: 8,
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
    outline: 'none',
  },
  primaryBtn: {
    width: '100%',
    padding: '10px 16px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: 8,
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  secondaryBtn: {
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid #374151',
    borderRadius: 8,
    color: '#e5e7eb',
    fontSize: 14,
    cursor: 'pointer',
  },
  leaveBtn: {
    width: '100%',
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: 8,
    color: '#ef4444',
    fontSize: 13,
    cursor: 'pointer',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '12px 0',
    color: '#6b7280',
    fontSize: 12,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
  },
  hint: {
    marginTop: 12,
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    borderRadius: 6,
    color: '#fca5a5',
    fontSize: 12,
    marginBottom: 12,
  },
}
