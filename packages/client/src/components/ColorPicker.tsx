import { useState, useRef, useEffect } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'

interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    // Delay to avoid immediate close from the toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div style={styles.container} ref={panelRef}>
      {/* Toggle button showing current color */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.toggleButton,
          background: color,
          border: isOpen ? '2px solid white' : '2px solid #4b5563',
        }}
        title="Open color picker"
      />

      {/* Picker panel */}
      {isOpen && (
        <div style={styles.panel}>
          <HexColorPicker color={color} onChange={onChange} />
          <HexColorInput
            color={color}
            onChange={onChange}
            prefixed
            style={styles.hexInput}
          />
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  toggleButton: {
    width: 24,
    height: 24,
    borderRadius: 5,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  panel: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: 12,
    padding: 12,
    background: 'rgba(17, 24, 39, 0.98)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    zIndex: 100,
  },
  hexInput: {
    width: '100%',
    padding: '6px 8px',
    background: '#1f2937',
    border: '1px solid #4b5563',
    borderRadius: 4,
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 12,
    textAlign: 'center',
    boxSizing: 'border-box',
  },
}
