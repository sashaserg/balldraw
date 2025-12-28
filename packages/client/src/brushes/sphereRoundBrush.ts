/**
 * Round brush for sphere geometry
 * 
 * Draws circular strokes that appear round on a sphere surface,
 * compensating for equirectangular UV distortion.
 */

import type { PaintEvent } from '../stores/eventStore'
import type { Brush, BrushConfig } from './types'
import { getHorizontalScale, getSphereAdjustedRadii } from '../utils/sphereUV'

/**
 * Create a round brush for sphere painting
 */
export function createSphereRoundBrush(): Brush {
  return {
    id: 'sphere-round',
    name: 'Round (Sphere)',

    render(event: PaintEvent, config: BrushConfig): void {
      const { ctx, baseColor } = config

      // Erase = paint with base color
      const color = event.type === 'erase' ? baseColor : event.color

      // Get distortion compensation for this latitude
      const horizontalScale = getHorizontalScale(event.position.v)

      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (event.fromPosition) {
        this.renderStroke(event, config, horizontalScale)
      } else {
        this.renderDot(event, config)
      }
    },

    /** Render a single dot (pointerdown without movement) */
    renderDot(event: PaintEvent, config: BrushConfig): void {
      const { ctx, textureSize, baseColor } = config
      const x = event.position.u * textureSize
      const y = (1 - event.position.v) * textureSize

      const color = event.type === 'erase' ? baseColor : event.color
      const { radiusX, radiusY } = getSphereAdjustedRadii(event.brushSize, event.position.v)

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
      ctx.fill()
    },

    /** Render a stroke from fromPosition to position */
    renderStroke(event: PaintEvent, config: BrushConfig, horizontalScale: number): void {
      const { ctx, textureSize, baseColor } = config
      
      if (!event.fromPosition) return

      const x = event.position.u * textureSize
      const y = (1 - event.position.v) * textureSize
      const fromX = event.fromPosition.u * textureSize
      const fromY = (1 - event.fromPosition.v) * textureSize

      const color = event.type === 'erase' ? baseColor : event.color
      ctx.strokeStyle = color

      // Check for UV seam crossing (wrapping around the sphere)
      const uDistance = Math.abs(event.position.u - event.fromPosition.u)

      if (uDistance > 0.5) {
        this.renderSeamCrossingStroke(event, config, horizontalScale)
      } else {
        // Normal stroke - use transform for distortion compensation
        ctx.save()
        ctx.lineWidth = event.brushSize
        ctx.scale(horizontalScale, 1)
        ctx.beginPath()
        ctx.moveTo(fromX / horizontalScale, fromY)
        ctx.lineTo(x / horizontalScale, y)
        ctx.stroke()
        ctx.restore()
      }
    },

    /** Render a stroke that crosses the UV seam (wraps around) */
    renderSeamCrossingStroke(event: PaintEvent, config: BrushConfig, horizontalScale: number): void {
      const { ctx, textureSize, baseColor } = config
      
      if (!event.fromPosition) return

      const fromU = event.fromPosition.u
      const toU = event.position.u
      const x = event.position.u * textureSize
      const y = (1 - event.position.v) * textureSize
      const fromX = fromU * textureSize
      const fromY = (1 - event.fromPosition.v) * textureSize

      const color = event.type === 'erase' ? baseColor : event.color
      ctx.strokeStyle = color

      ctx.save()
      ctx.lineWidth = event.brushSize
      ctx.scale(horizontalScale, 1)

      if (fromU > toU) {
        // Crossing from high U to low U (right edge to left)
        const t = (1 - fromU) / ((1 - fromU) + toU)
        const seamY = fromY + (y - fromY) * t

        // Segment 1: from start to right edge
        ctx.beginPath()
        ctx.moveTo(fromX / horizontalScale, fromY)
        ctx.lineTo(textureSize / horizontalScale, seamY)
        ctx.stroke()

        // Segment 2: from left edge to end
        ctx.beginPath()
        ctx.moveTo(0, seamY)
        ctx.lineTo(x / horizontalScale, y)
        ctx.stroke()
      } else {
        // Crossing from low U to high U (left edge to right)
        const t = fromU / (fromU + (1 - toU))
        const seamY = fromY + (y - fromY) * t

        // Segment 1: from start to left edge
        ctx.beginPath()
        ctx.moveTo(fromX / horizontalScale, fromY)
        ctx.lineTo(0, seamY)
        ctx.stroke()

        // Segment 2: from right edge to end
        ctx.beginPath()
        ctx.moveTo(textureSize / horizontalScale, seamY)
        ctx.lineTo(x / horizontalScale, y)
        ctx.stroke()
      }

      ctx.restore()
    },
  } as Brush & {
    renderDot: (event: PaintEvent, config: BrushConfig) => void
    renderStroke: (event: PaintEvent, config: BrushConfig, horizontalScale: number) => void
    renderSeamCrossingStroke: (event: PaintEvent, config: BrushConfig, horizontalScale: number) => void
  }
}

/** Default sphere brush instance */
export const sphereRoundBrush = createSphereRoundBrush()
