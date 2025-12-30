import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useProjectStore } from '../stores/projectStore'

export function JoinSessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { joinSession, status, error, isInSession } = useSessionStore()
  const { setIsHost } = useProjectStore()
  const [userName, setUserName] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Redirect to painting view once joined
  useEffect(() => {
    if (isInSession && sessionId) {
      // Navigate to a special "session" route that doesn't require a project
      navigate(`/session/${sessionId}`)
    }
  }, [isInSession, sessionId, navigate])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!sessionId || !userName.trim()) return
    
    setIsJoining(true)
    setIsHost(false) // Joiner is not the host
    
    const success = await joinSession(sessionId, userName.trim())
    
    if (!success) {
      setIsJoining(false)
    }
    // If successful, the useEffect above will handle navigation
  }

  if (!sessionId) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={styles.subtitle}>No session ID provided</p>
          <button onClick={() => navigate('/')} style={styles.backButton}>
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎨 Join DrawBall Session</h1>
        <p style={styles.subtitle}>Session: {sessionId}</p>
        
        <form onSubmit={handleJoin} style={styles.form}>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            style={styles.input}
            autoFocus
            disabled={isJoining}
            maxLength={20}
          />
          
          <button 
            type="submit" 
            style={{
              ...styles.joinButton,
              opacity: isJoining || !userName.trim() ? 0.6 : 1,
              cursor: isJoining || !userName.trim() ? 'not-allowed' : 'pointer',
            }}
            disabled={isJoining || !userName.trim()}
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </form>
        
        {error && (
          <p style={styles.error}>{error}</p>
        )}
        
        {status === 'connecting' && (
          <p style={styles.connecting}>Connecting...</p>
        )}
        
        <button onClick={() => navigate('/')} style={styles.backLink}>
          ← Back to my projects
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: 20,
  },
  card: {
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 40,
    textAlign: 'center',
    maxWidth: 400,
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    margin: 0,
    marginBottom: 32,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 16,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  joinButton: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 16,
    fontWeight: 600,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 0,
  },
  connecting: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 0,
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 24,
    cursor: 'pointer',
    padding: 0,
  },
  backButton: {
    padding: '12px 24px',
    fontSize: 14,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    marginTop: 16,
  },
}
