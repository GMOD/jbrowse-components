import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import { DEFAULT_SCORE_COLUMN } from '../GWASAdapter/configSchema.ts'
import { DEFAULT_MANHATTAN_COLOR } from '../ManhattanRPC/rpcTypes.ts'

import type { LinearManhattanDisplayModel } from './stateModelFactory.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  bedGzLocation?: { uri?: string }
  uri?: string
  scoreColumn?: string
  scoreTransform?: string
}

// R expression for the raw score-column value mapped into Manhattan -log10(p)
// space, mirroring GWASAdapter's native scoreTransform modes. An arbitrary
// jexl: transform can't be reproduced, so it falls back to the raw column
// (already -log10 for the common Pan-UKBB case) — the user edits the emitted
// aes() if their file needs something else.
function scoreExpr(transform: string | undefined) {
  return transform === 'negLog10'
    ? '-log10(pmax(score, .Machine$double.xmin))'
    : transform === 'negLog10FromLn'
      ? '-score / log(10)'
      : 'score'
}

export interface ManhattanRParams {
  trackId: string
  trackName: string
  uri: string
  scoreColumn: string
  scoreTransform?: string
  color: string
  pointSize: number
}

/**
 * Pure builder for the R ggplot panel of a GWAS Manhattan track. Reads the
 * tabix'd BED over the region with the inline `read_gwas()` helper (Rsamtools
 * scanTabix, looking the score column up by name in the header), draws each
 * association as a `geom_point` at its genomic position against -log10(p), and
 * marks the 5e-8 genome-wide significance line with `geom_hline`. Pure ggplot2 +
 * inline helpers, no bespoke package. `read_regions()` reads every region in the
 * view onto one cumulative-bp x-axis (JBrowse's multi-region view); the shared
 * axis + dividers are added by plot_regions(). LD (r²) coloring is not
 * reproduced — the panel is the standard single-color Manhattan.
 */
export function manhattanFragment(p: ManhattanRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const color = p.color.startsWith('jexl') ? DEFAULT_MANHATTAN_COLOR : p.color
  const size = Math.max(0.4, p.pointSize / 4)
  const y = scoreExpr(p.scoreTransform)
  const data = `read_regions(function(chrom, start, end) read_gwas(${pathVar}, chrom, start, end, ${rStr(p.scoreColumn)}), regions, c("pos"))`
  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['Rsamtools', 'GenomicRanges', 'ggplot2'],
    helpers: ['read_gwas'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    heightWeight: 2,
    plotExpr: `ggplot(${data}) +
  geom_hline(yintercept = -log10(5e-8), linetype = "dashed", color = "grey60") +
  geom_point(aes(x = pos, y = ${y}), color = ${rStr(color)}, size = ${size}, na.rm = TRUE) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = "-log10(p)") +
  theme_minimal()`,
  }
}

/** Read the Manhattan display's resolved styling + source uri into a fragment. */
export function exportRCode(self: LinearManhattanDisplayModel): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  return manhattanFragment({
    trackId,
    trackName,
    uri: firstUri(adapter.bedGzLocation?.uri, adapter.uri),
    scoreColumn: adapter.scoreColumn ?? DEFAULT_SCORE_COLUMN,
    scoreTransform: adapter.scoreTransform,
    color: self.color,
    pointSize: self.scatterPointSize,
  })
}
