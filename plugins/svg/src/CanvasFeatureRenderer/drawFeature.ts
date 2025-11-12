import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a processed transcript feature (special handling for CDS/UTR subfeatures)
 */
export function drawProcessedTranscript(args: DrawFeatureArgs): DrawingResult {
  const { featureLayout } = args

  // Draw the connecting line
  const result = drawSegments(args)

  // Draw subfeatures
  for (const childLayout of featureLayout.children) {
    const subResult = drawFeature({
      ...args,
      feature: childLayout.feature,
      featureLayout: childLayout,
      topLevel: false,
    })
    result.coords.push(...subResult.coords)
    result.items.push(...subResult.items)
  }

  return result
}

/**
 * Draw a feature based on its glyph type, dispatching to the appropriate
 * drawing function
 */
export function drawFeature(args: DrawFeatureArgs): DrawingResult {
  const { feature, config, topLevel, featureLayout } = args
  const glyphType = chooseGlyphType({ feature, config })

  let result: DrawingResult

  switch (glyphType) {
    case 'ProcessedTranscript':
      result = drawProcessedTranscript(args)
      break
    case 'Segments': {
      // Draw the connecting line
      result = drawSegments(args)
      // Draw subfeatures
      for (const childLayout of featureLayout.children) {
        const subResult = drawFeature({
          ...args,
          feature: childLayout.feature,
          featureLayout: childLayout,
          topLevel: false,
        })
        result.coords.push(...subResult.coords)
        result.items.push(...subResult.items)
      }
      break
    }
    case 'CDS':
      // For now, CDS is just drawn as a box (amino acids skipped)
      result = drawBox(args)
      break
    case 'Subfeatures': {
      // Draw subfeatures vertically offset
      const coords: number[] = []
      const items = []
      for (const childLayout of featureLayout.children) {
        const subResult = drawFeature({
          ...args,
          feature: childLayout.feature,
          featureLayout: childLayout,
          topLevel: false,
        })
        coords.push(...subResult.coords)
        items.push(...subResult.items)
      }
      result = { coords, items }
      break
    }
    default:
      result = drawBox(args)
      break
  }

  // Draw arrow for top-level features
  if (topLevel) {
    const arrowResult = drawArrow(args)
    result.coords.push(...arrowResult.coords)
    result.items.push(...arrowResult.items)
  }

  // Draw bounding box for debugging
  // if (topLevel) {
  //   const { ctx, featureLayout } = args
  //   ctx.save()
  //   ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)' // Semi-transparent red
  //   ctx.lineWidth = 1
  //   ctx.setLineDash([2, 2]) // Dashed line
  //   ctx.strokeRect(
  //     featureLayout.x,
  //     featureLayout.y,
  //     featureLayout.totalWidth,
  //     featureLayout.totalHeight,
  //   )
  //   ctx.restore()
  // }

  return result
}
