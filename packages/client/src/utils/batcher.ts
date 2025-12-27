/**
 * Batches function calls over a time window.
 * 
 * Collects items and flushes them in batches either:
 * - When the batch reaches maxSize
 * - After delayMs since the first item in the batch
 * 
 * This reduces the number of state updates and re-renders when many
 * events arrive in quick succession (e.g., multiple users painting).
 */
export function createBatcher<T>(
  onFlush: (items: T[]) => void,
  options: {
    delayMs?: number
    maxSize?: number
  } = {}
) {
  const { delayMs = 16, maxSize = 50 } = options // 16ms ≈ 1 frame at 60fps
  
  let batch: T[] = []
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  const flush = () => {
    if (batch.length === 0) return
    
    const items = batch
    batch = []
    
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    
    onFlush(items)
  }
  
  const add = (item: T) => {
    batch.push(item)
    
    // Flush immediately if batch is full
    if (batch.length >= maxSize) {
      flush()
      return
    }
    
    // Schedule flush if this is the first item
    if (timeoutId === null) {
      timeoutId = setTimeout(flush, delayMs)
    }
  }
  
  const clear = () => {
    batch = []
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  return { add, flush, clear }
}
