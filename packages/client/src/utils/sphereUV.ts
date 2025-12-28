/**
 * Sphere UV distortion utilities
 * 
 * Equirectangular projection (standard sphere UV mapping) has two types of distortion:
 * 
 * 1. Base 2:1 aspect ratio
 *    - UV maps 360° longitude (U) to 180° latitude (V)
 *    - A square on the texture appears 2x stretched horizontally on the sphere
 *    - Fix: multiply horizontal by 0.5
 * 
 * 2. Latitude-dependent compression (Mercator-like)
 *    - Near poles, longitude lines converge
 *    - Horizontal distances are compressed by sin(θ) where θ is colatitude
 *    - At equator (v=0.5): sin(π/2) = 1, no extra distortion
 *    - At poles (v=0 or v=1): sin(0) or sin(π) → 0, maximum compression
 *    - Fix: divide horizontal by sin(θ)
 * 
 * Combined: horizontalScale = 0.5 / sin(v * π)
 */

/**
 * Calculate the horizontal scale factor needed to compensate for sphere UV distortion
 * 
 * @param v - V coordinate (0 = north pole, 0.5 = equator, 1 = south pole)
 * @returns Scale factor to multiply horizontal dimensions by (< 1 means compress)
 * 
 * @example
 * // At equator
 * getHorizontalScale(0.5) // → 0.5
 * 
 * // Near poles (clamped to avoid infinity)
 * getHorizontalScale(0.01) // → ~0.05 (clamped)
 */
export function getHorizontalScale(v: number): number {
  const theta = v * Math.PI // 0 at north pole, π at south pole
  const sinTheta = Math.sin(theta)
  
  // Clamp to avoid division issues very close to poles
  const latitudeScale = Math.max(sinTheta, 0.1)
  
  // 0.5 for 2:1 base aspect ratio, divided by latitudeScale for polar compression
  return 0.5 / latitudeScale
}

/**
 * Get the effective brush radii for drawing on a sphere texture
 * 
 * @param brushSize - The nominal brush diameter in pixels
 * @param v - V coordinate (0-1, where 0.5 is equator)
 * @returns Object with radiusX and radiusY for drawing an ellipse
 */
export function getSphereAdjustedRadii(
  brushSize: number,
  v: number
): { radiusX: number; radiusY: number } {
  const horizontalScale = getHorizontalScale(v)
  return {
    radiusX: (brushSize / 2) * horizontalScale,
    radiusY: brushSize / 2,
  }
}
