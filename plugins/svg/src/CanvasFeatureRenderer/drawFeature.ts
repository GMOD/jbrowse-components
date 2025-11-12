import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawSegments } from './drawSegments'
import { getSubparts } from './filterSubparts'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a processed transcript feature (special handling for CDS/UTR subfeatures)
 */
export function drawProcessedTranscript(args: DrawFeatureArgs): DrawingResult {
  const { feature, config, featureLayout } = args
  const subparts = getSubparts(feature, config)

  // Draw the connecting line
  const result = drawSegments(args)

  // Draw subfeatures
  for (const subfeature of subparts) {
    const subfeatureId = String(subfeature.id())
    const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
    if (subfeatureLayout) {
      const subResult = drawFeature({
        ...args,
        feature: subfeature,
        featureLayout: subfeatureLayout,
        topLevel: false,
      })
      result.coords.push(...subResult.coords)
      result.items.push(...subResult.items)
    }
  }

  return result
}

/**
 * Draw a feature based on its glyph type, dispatching to the appropriate
 * drawing function
 */
export function drawFeature(args: DrawFeatureArgs): DrawingResult {
  const { feature, config, topLevel } = args
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
      const subfeatures = feature.get('subfeatures') || []
      for (const subfeature of subfeatures) {
        const subfeatureId = String(subfeature.id())
        const subfeatureLayout = args.featureLayout.getSubRecord(subfeatureId)
        if (subfeatureLayout) {
          const subResult = drawFeature({
            ...args,
            feature: subfeature,
            featureLayout: subfeatureLayout,
            topLevel: false,
          })
          result.coords.push(...subResult.coords)
          result.items.push(...subResult.items)
        }
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
      const subfeatures = feature.get('subfeatures') || []
      for (const subfeature of subfeatures) {
        const subfeatureId = String(subfeature.id())
        const subfeatureLayout = args.featureLayout.getSubRecord(subfeatureId)
        if (subfeatureLayout) {
          const subResult = drawFeature({
            ...args,
            feature: subfeature,
            featureLayout: subfeatureLayout,
            topLevel: false,
          })
          coords.push(...subResult.coords)
          items.push(...subResult.items)
        }
      }
      result = { coords, items }
      break
    }
    case 'Box':
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

  return result
}
