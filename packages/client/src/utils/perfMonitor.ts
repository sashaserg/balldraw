/**
 * Performance monitoring utilities for DrawBall
 * 
 * Measures and logs performance metrics to validate assumptions about bottlenecks.
 * Enable/disable via window.__drawball_perf.enabled
 */

interface PerfMetrics {
  // Frame-level metrics
  frameCount: number
  lastFrameTime: number
  
  // getAllEventsSorted metrics
  sortCallCount: number
  sortTotalTime: number
  sortMaxTime: number
  lastSortEventCount: number
  cacheHits: number
  cacheMisses: number
  
  // findIndex metrics  
  findIndexCallCount: number
  findIndexTotalTime: number
  findIndexMaxTime: number
  
  // Render metrics
  renderCallCount: number
  eventsRenderedTotal: number
  
  // Memory
  peakEventCount: number
}

const metrics: PerfMetrics = {
  frameCount: 0,
  lastFrameTime: 0,
  sortCallCount: 0,
  sortTotalTime: 0,
  sortMaxTime: 0,
  lastSortEventCount: 0,
  cacheHits: 0,
  cacheMisses: 0,
  findIndexCallCount: 0,
  findIndexTotalTime: 0,
  findIndexMaxTime: 0,
  renderCallCount: 0,
  eventsRenderedTotal: 0,
  peakEventCount: 0,
}

let enabled = false
let logInterval: number | null = null

export const perfMonitor = {
  enable() {
    enabled = true
    this.reset()
    // Log every 5 seconds
    logInterval = window.setInterval(() => this.logSummary(), 5000)
    console.log('🔬 Performance monitoring ENABLED - will log every 5s')
  },
  
  disable() {
    enabled = false
    if (logInterval) {
      clearInterval(logInterval)
      logInterval = null
    }
    console.log('🔬 Performance monitoring DISABLED')
  },
  
  reset() {
    Object.assign(metrics, {
      frameCount: 0,
      lastFrameTime: performance.now(),
      sortCallCount: 0,
      sortTotalTime: 0,
      sortMaxTime: 0,
      lastSortEventCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      findIndexCallCount: 0,
      findIndexTotalTime: 0,
      findIndexMaxTime: 0,
      renderCallCount: 0,
      eventsRenderedTotal: 0,
      // Don't reset peak
    })
  },
  
  // Call this at start of useFrame
  frameStart() {
    if (!enabled) return
    metrics.frameCount++
  },
  
  // Wrap getAllEventsSorted - tracks call timing
  // Cache effectiveness is shown by avg time dropping to near 0
  trackSort<T>(fn: () => T): T {
    if (!enabled) return fn()
    
    const start = performance.now()
    const result = fn()
    const elapsed = performance.now() - start
    
    metrics.sortCallCount++
    metrics.sortTotalTime += elapsed
    metrics.sortMaxTime = Math.max(metrics.sortMaxTime, elapsed)
    
    // Track cache hits (time < 0.01ms means likely cached)
    if (elapsed < 0.01) {
      metrics.cacheHits++
    } else {
      metrics.cacheMisses++
    }
    
    // Track array size
    if (Array.isArray(result)) {
      metrics.lastSortEventCount = result.length
      metrics.peakEventCount = Math.max(metrics.peakEventCount, result.length)
    }
    
    return result
  },
  
  // Wrap findIndex
  trackFindIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
    if (!enabled) {
      return arr.findIndex(predicate)
    }
    
    const start = performance.now()
    const result = arr.findIndex(predicate)
    const elapsed = performance.now() - start
    
    metrics.findIndexCallCount++
    metrics.findIndexTotalTime += elapsed
    metrics.findIndexMaxTime = Math.max(metrics.findIndexMaxTime, elapsed)
    
    return result
  },
  
  // Track event renders
  trackRender(eventCount: number) {
    if (!enabled) return
    metrics.renderCallCount++
    metrics.eventsRenderedTotal += eventCount
  },
  
  logSummary() {
    if (!enabled) return
    
    const elapsed = (performance.now() - metrics.lastFrameTime) / 1000
    const fps = metrics.frameCount / elapsed
    
    const avgSortTime = metrics.sortCallCount > 0 
      ? (metrics.sortTotalTime / metrics.sortCallCount).toFixed(3) 
      : '0'
    
    const avgFindTime = metrics.findIndexCallCount > 0
      ? (metrics.findIndexTotalTime / metrics.findIndexCallCount).toFixed(3)
      : '0'
    
    console.log(`
📊 DrawBall Performance (last ${elapsed.toFixed(1)}s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FPS: ${fps.toFixed(1)} (${metrics.frameCount} frames)

getAllEventsSorted():
  Calls: ${metrics.sortCallCount} (${(metrics.sortCallCount / elapsed).toFixed(1)}/sec)
  Cache hits: ${metrics.cacheHits} | misses: ${metrics.cacheMisses}
  Avg time: ${avgSortTime}ms (cache hit ≈ 0ms, miss = actual sort)
  Max time: ${metrics.sortMaxTime.toFixed(3)}ms
  Events in array: ${metrics.lastSortEventCount}
  Peak events: ${metrics.peakEventCount}

findIndex():
  Calls: ${metrics.findIndexCallCount}
  Avg time: ${avgFindTime}ms
  Max time: ${metrics.findIndexMaxTime.toFixed(3)}ms

Rendering:
  Render calls: ${metrics.renderCallCount}
  Total events rendered: ${metrics.eventsRenderedTotal}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
    
    this.reset()
  },
  
  getMetrics() {
    return { ...metrics }
  }
}

// Expose globally for easy access
// @ts-expect-error - global
window.__drawball_perf = perfMonitor
