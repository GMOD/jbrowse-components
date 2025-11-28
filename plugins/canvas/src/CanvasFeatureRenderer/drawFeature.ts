import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

import type { DrawFeatureArgs } from './types'

function drawChildFeatures(args: DrawFeatureArgs) {
  drawSegments(args)
  for (const childLayout of args.featureLayout.children) {
    drawFeature({
      ...args,
      feature: childLayout.feature,
      featureLayout: childLayout,
      topLevel: false,
    })
  }
}

export function drawFeature(args: DrawFeatureArgs) {
  const { feature, configContext, topLevel, featureLayout } = args
  const glyphType = chooseGlyphType({ feature, configContext })

  switch (glyphType) {
    case 'ProcessedTranscript':
    case 'Segments':
      drawChildFeatures(args)
      drawArrow(args)
      break
    case 'CDS':
      drawCDS(args)
      break
    case 'Subfeatures': {
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
    }
    default:
      drawBox(args)
      break
  }

  if (topLevel && glyphType !== 'Subfeatures') {
    drawArrow(args)
  }
}
