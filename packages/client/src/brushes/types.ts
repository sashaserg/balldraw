/**
 * Brush system types
 * 
 * Brushes are responsible for rendering paint events to a canvas texture.
 * Different geometries (sphere, cube, etc.) may need different brush implementations
 * to compensate for UV mapping distortions.
 */

import type { PaintEvent } from '../stores/eventStore'

/** Configuration for brush rendering */
export interface BrushConfig {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D
  /** Size of the texture canvas (assumed square) */
  textureSize: number
  /** Base/background color (used for erasing) */
  baseColor: string
}

/** A brush that can render paint events to a canvas */
export interface Brush {
  /** Unique identifier for this brush type */
  readonly id: string
  /** Human-readable name */
  readonly name: string
  
  /**
   * Render a paint event to the canvas
   * Handles both painting and erasing (erase = paint with baseColor)
   */
  render(event: PaintEvent, config: BrushConfig): void
}

/** Factory function type for creating brushes */
export type BrushFactory = () => Brush
