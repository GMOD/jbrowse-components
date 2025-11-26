import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

/**
 * Draw a processed transcript feature (special handling for CDS/UTR subfeatures)
 */
export function drawProcessedTranscript(args: DrawFeatureArgs): DrawingResult {
  const {
    featureLayout,
    peptideDataMap,
    colorByCDS,
    color1,
    color3,
    isColor1Callback,
    isColor3Callback,
  } = args

  // Draw the connecting line
  const result = drawSegments(args)

  // Draw subfeatures
  for (const childLayout of featureLayout.children) {
    const subResult = drawFeature({
      ...args,
      feature: childLayout.feature,
      featureLayout: childLayout,
      topLevel: false,
      peptideDataMap,
      colorByCDS,
      color1,
      color3,
      isColor1Callback,
      isColor3Callback,
    })
    for (const c of subResult.coords) {
      result.coords.push(c)
    }
    for (const item of subResult.items) {
      result.items.push(item)
    }
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
          peptideDataMap: args.peptideDataMap,
          colorByCDS: args.colorByCDS,
        })
        for (const c of subResult.coords) {
          result.coords.push(c)
        }
        for (const item of subResult.items) {
          result.items.push(item)
        }
      }
      break
    }
    case 'CDS':
      // Draw CDS with optional peptide rendering
      result = drawCDS(args)
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
          peptideDataMap: args.peptideDataMap,
          colorByCDS: args.colorByCDS,
        })
        for (const c of subResult.coords) {
          coords.push(c)
        }
        for (const item of subResult.items) {
          items.push(item)
        }
      }
      result = { coords, items }
      break
    }
    default:
      result = drawBox(args)
      break
  }

  // Draw arrow for top-level features (but not for containers like genes)
  if (topLevel && glyphType !== 'Subfeatures') {
    const arrowResult = drawArrow(args)
    for (const c of arrowResult.coords) {
      result.coords.push(c)
    }
    for (const item of arrowResult.items) {
      result.items.push(item)
    }
  }

  return result
}
