import { paintInsertionLabels } from '@jbrowse/alignments-core'
import { colorLongreadInv } from '@jbrowse/core/ui/palette'

import {
  getFrameColors,
  getMafColorPalette,
  getMafLabelColors,
} from '../util.ts'
import { drawMafAnnotations } from './annotations.ts'
import { drawMafCodons } from './codons.ts'
import { drawMafDeletionLabels } from './deletions.ts'
import { drawMafEmptyLines } from './emptyLines.ts'
import { drawInversions } from './inversions.ts'
import { drawMafLabels } from './labels.ts'

import type { CodonGlyph } from '../../LinearMafDisplay/codons.ts'
import type { FrameMarker } from '../../LinearMafDisplay/components/computeVisibleAnnotations.ts'
import type { DeletionMarker } from '../../LinearMafDisplay/components/computeVisibleDeletions.ts'
import type { EmptyLineSegment } from '../../LinearMafDisplay/components/computeVisibleEmptyLines.ts'
import type { InversionMarker } from '../../LinearMafDisplay/components/computeVisibleInversions.ts'
import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

type InsertionLabelArgs = Parameters<typeof paintInsertionLabels>

/** What the rows draw over their cells, each already placed in the viewport. */
export interface MafRowOverlays {
  emptyLines: EmptyLineSegment[]
  frames: FrameMarker[]
  insertions: {
    blocks: InsertionLabelArgs[1]
    channelsOf: InsertionLabelArgs[2]
    frame: InsertionLabelArgs[3]
    params: InsertionLabelArgs[4]
  }
  deletions: DeletionMarker[]
  labels: VisibleLabel[]
  codonGlyphs: CodonGlyph[]
  inversions: InversionMarker[]
}

/** The overlays' colors in one theme, resolved once per theme. */
export function getMafOverlayTheme(palette: JBrowsePalette) {
  return {
    colors: getMafColorPalette(palette),
    frameColors: getFrameColors(palette),
    labelColors: getMafLabelColors(palette),
    text: palette.text.primary,
  }
}

export type MafOverlayTheme = ReturnType<typeof getMafOverlayTheme>

/**
 * Every rows overlay in paint order, which the screen's overlay canvas and the
 * SVG export both call.
 */
export function paintMafRowOverlays(
  ctx: Ctx2D & InsertionLabelArgs[0],
  overlays: MafRowOverlays,
  theme: MafOverlayTheme,
) {
  const { blocks, channelsOf, frame, params } = overlays.insertions
  drawMafEmptyLines(ctx, overlays.emptyLines, theme.colors)
  drawMafAnnotations(ctx, overlays.frames, theme.frameColors)
  paintInsertionLabels(ctx, blocks, channelsOf, frame, params)
  drawMafDeletionLabels(ctx, overlays.deletions, theme.colors)
  drawMafLabels(ctx, overlays.labels, theme.labelColors)
  drawMafCodons(ctx, overlays.codonGlyphs, theme.text)
  drawInversions(ctx, overlays.inversions, colorLongreadInv)
}
