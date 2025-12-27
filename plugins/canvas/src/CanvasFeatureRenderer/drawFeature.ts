import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'

import type { DrawFeatureArgs } from './types'

function findMatchingGlyph(args: DrawFeatureArgs) {
  const { feature, pluginManager } = args
  if (!pluginManager) {
    return undefined
  }
  const glyphTypes = pluginManager.getGlyphTypes()
  // Sort by priority descending (higher priority first)
  const sortedGlyphs = [...glyphTypes].sort((a, b) => b.priority - a.priority)
  return sortedGlyphs.find(glyph => glyph.match?.(feature))
}

export function drawFeature(args: DrawFeatureArgs) {
  const { topLevel, featureLayout } = args

  const pluggableGlyph = findMatchingGlyph(args)
  if (pluggableGlyph) {
    pluggableGlyph.draw({
      ctx: args.ctx,
      feature: args.feature,
      featureLayout: args.featureLayout,
      region: args.region,
      bpPerPx: args.bpPerPx,
      config: args.config,
      theme: args.theme,
      reversed: args.reversed,
      topLevel: args.topLevel,
      canvasWidth: args.canvasWidth,
    })
    return
  }

  // Use the glyph type computed during layout - no need to recalculate
  const { glyphType } = featureLayout

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
