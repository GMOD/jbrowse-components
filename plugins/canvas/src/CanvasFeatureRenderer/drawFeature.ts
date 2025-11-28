import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

// accumulates coords/items from child features into the parent's result for flatbush indexing
function mergeResults(target: DrawingResult, source: DrawingResult) {
  target.coords.push(...source.coords)
  target.items.push(...source.items)
}

function drawChildFeatures(args: DrawFeatureArgs): DrawingResult {
  const result = drawSegments(args)
  for (const childLayout of args.featureLayout.children) {
    mergeResults(
      result,
      drawFeature({
        ...args,
        feature: childLayout.feature,
        featureLayout: childLayout,
        topLevel: false,
      }),
    )
  }
  return result
}

export function drawFeature(args: DrawFeatureArgs): DrawingResult {
  const { feature, config, topLevel, featureLayout } = args
  const glyphType = chooseGlyphType({ feature, config })

  let result: DrawingResult

  switch (glyphType) {
    case 'ProcessedTranscript':
    case 'Segments':
      result = drawChildFeatures(args)
      break
    case 'CDS':
      result = drawCDS(args)
      break
    case 'Subfeatures': {
      result = { coords: [], items: [] }
      for (const childLayout of featureLayout.children) {
        mergeResults(
          result,
          drawFeature({
            ...args,
            feature: childLayout.feature,
            featureLayout: childLayout,
            topLevel: false,
          }),
        )
      }
      break
    }
    default:
      result = drawBox(args)
      break
  }

  if (topLevel && glyphType !== 'Subfeatures') {
    mergeResults(result, drawArrow(args))
  }

  return result
}
