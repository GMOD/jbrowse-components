import { drawArrow } from './drawArrow'
import { drawBox } from './drawBox'
import { drawCDS } from './drawCDS'
import { drawSegments } from './drawSegments'
import { chooseGlyphType } from './util'

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
  const { feature, configContext, topLevel, featureLayout } = args

  const pluggableGlyph = findMatchingGlyph(args)
  if (pluggableGlyph) {
    pluggableGlyph.draw({
      ctx: args.ctx,
      feature: args.feature,
      featureLayout: {
        feature: args.featureLayout.feature,
        x: args.featureLayout.x,
        y: args.featureLayout.y,
        width: args.featureLayout.width,
        height: args.featureLayout.height,
        children: args.featureLayout.children,
      },
      region: args.region,
      bpPerPx: args.bpPerPx,
      configSnapshot: args.configSnapshot,
      theme: args.theme,
      jexl: args.jexl,
      reversed: args.reversed,
      topLevel: args.topLevel,
      canvasWidth: args.canvasWidth,
    })
    return
  }

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
