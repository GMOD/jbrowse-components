import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs } from './types'

export function drawFeature(args: DrawFeatureArgs) {
  const { feature, configContext, topLevel, featureLayout } = args
  const glyphType = chooseGlyphType({ feature, configContext })

  switch (glyphType) {
    case 'ProcessedTranscript':
    case 'Segments':
      drawSegments(args)
      for (const childLayout of featureLayout.children) {
        drawFeature({
          ...args,
          feature: childLayout.feature,
          featureLayout: childLayout,
          topLevel: false,
        })
      }
      drawArrow(args)
      break
    case 'CDS':
      drawCDS(args)
      if (topLevel) {
        drawArrow(args)
      }
      break
    case 'Subfeatures':
      if (featureLayout.children.length === 0) {
        drawBox(args)
        drawArrow(args)
      } else {
        for (const childLayout of featureLayout.children) {
          drawFeature({
            ...args,
            feature: childLayout.feature,
            featureLayout: childLayout,
            topLevel: false,
          })
        }
      }
      break
    default:
      drawBox(args)
      if (topLevel) {
        drawArrow(args)
      }
      break
  }
}
