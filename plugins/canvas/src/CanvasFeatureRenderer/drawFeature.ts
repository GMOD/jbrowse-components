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
          peptideDataMap: args.peptideDataMap,
          colorByCDS: args.colorByCDS,
        })
        result.coords.push(...subResult.coords)
        result.items.push(...subResult.items)
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

  // Draw bounding box for debugging (shows totalLayoutWidth and totalLayoutHeight)
  // if (topLevel) {
  //   const { ctx, featureLayout } = args
  //   ctx.save()
  //   ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)' // Semi-transparent red
  //   ctx.lineWidth = 1
  //   ctx.setLineDash([2, 2]) // Dashed line
  //   ctx.strokeRect(
  //     featureLayout.x,
  //     featureLayout.y,
  //     featureLayout.totalLayoutWidth,
  //     featureLayout.totalLayoutHeight,
  //   )
  //   ctx.restore()
  // }

  return result
}
