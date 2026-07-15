import {
  firstUri,
  getTrackRMeta,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  bigWigLocation?: { uri?: string }
  uri?: string
}

export interface WiggleRParams {
  trackId: string
  trackName: string
  uri: string
  isDensity: boolean
  isLine: boolean
  useBicolor: boolean
  color: string
  posColor: string
  negColor: string
  bicolorPivot: number
}

/**
 * Pure builder for the R ggplot panel of a single-source wiggle track, using
 * plain ggplot2 geoms and a `read_bigwig()` helper (no bespoke package): binned
 * coverage is `geom_rect`, line mode is `geom_step`, bicolor is just a fill
 * mapped to the sign of the score, density is a `geom_rect` strip on a viridis
 * fill. The panel reads `chrom`, `start`, `end` from the enclosing
 * plot_region() so it is redrawn for whatever locus is passed in.
 */
export function wiggleFragment(p: WiggleRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const data = `read_bigwig(${pathVar}, chrom, start, end)`

  let body: string
  if (p.isDensity) {
    body = `geom_rect(aes(xmin = start, xmax = end, ymin = 0, ymax = 1, fill = score)) +
  scale_fill_viridis_c() +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, fill = "Score") +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.title.y = element_blank(), axis.ticks.y = element_blank())`
  } else if (p.isLine) {
    body = `geom_step(aes(x = start, y = score), color = ${rStr(p.color)}) +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = "Score") +
  theme_minimal()`
  } else if (p.useBicolor) {
    body = `geom_rect(aes(xmin = start, xmax = end, ymin = 0, ymax = score, fill = score >= ${p.bicolorPivot})) +
  scale_fill_manual(values = c(\`TRUE\` = ${rStr(p.posColor)}, \`FALSE\` = ${rStr(p.negColor)}), guide = "none") +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = "Score") +
  theme_minimal()`
  } else {
    body = `geom_rect(aes(xmin = start, xmax = end, ymin = 0, ymax = score), fill = ${rStr(p.color)}) +
  bp_axis() +
  coord_cartesian(xlim = c(start, end)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = "Score") +
  theme_minimal()`
  }

  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['rtracklayer', 'ggplot2'],
    helpers: ['read_bigwig', 'bp_axis'],
    setup: `${pathVar} <- ${rStr(p.uri)}`,
    plotVariable: `p_${pathVar}`,
    plotExpr: `ggplot(${data}) +
  ${body}`,
  }
}

/** Read the display model's resolved styling + source uri into an R fragment. */
export function exportRCode(self: LinearWiggleDisplayModel): RTrackFragment {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  return wiggleFragment({
    trackId,
    trackName,
    uri: firstUri(adapter.bigWigLocation?.uri, adapter.uri),
    isDensity: self.isDensityMode,
    isLine: self.renderingType === 'line',
    useBicolor: self.useBicolor,
    color: self.color,
    posColor: self.posColor,
    negColor: self.negColor,
    bicolorPivot: self.bicolorPivot,
  })
}
