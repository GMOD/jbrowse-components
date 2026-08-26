import {
  FIGURE_DPI,
  FIGURE_INCHES_PER_WEIGHT,
  firstUri,
  getTrackRMeta,
  rName,
  rStr,
  safeVarName,
} from '@jbrowse/display-kit/RExportFragment'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type {
  RFileLocation,
  RTrackFragment,
} from '@jbrowse/display-kit/RExportFragment'

interface SubadapterConf {
  type?: string
  source?: string
  name?: string
  bigWigLocation?: RFileLocation
  uri?: string
}

interface MultiAdapterConf {
  subadapters?: SubadapterConf[]
  bigWigs?: string[]
}

// Basename without extension, matching MultiWiggleAdapter's filename-derived
// source name for the `bigWigs` shorthand.
function baseName(uri: string) {
  const file = uri.slice(uri.lastIndexOf('/') + 1)
  const dot = file.lastIndexOf('.')
  return dot === -1 ? file : file.slice(0, dot)
}

// Map each subtrack source name -> its BigWig uri, mirroring the adapter's own
// source-name derivation (source || name || filename) so the map keys line up
// with the display's `sources`.
function buildSourceUriMap(adapter: MultiAdapterConf) {
  const map = new Map<string, string>()
  const subs = adapter.subadapters
  if (subs?.length) {
    for (const sub of subs) {
      // firstUri, not a local reader: a subadapter location carries the same
      // localPath / relative-uri-plus-baseUri cases the top-level ones do, and
      // the hand-rolled version here missed both — a multi-wiggle over a
      // url-loaded config emitted bare filenames R could not open.
      const uri = firstUri(sub.bigWigLocation, sub.uri)
      if (uri) {
        map.set(sub.source || sub.name || baseName(uri), uri)
      }
    }
  } else {
    for (const url of adapter.bigWigs ?? []) {
      map.set(baseName(url), url)
    }
  }
  return map
}

type GeomKind = 'area' | 'step' | 'line' | 'point'

// Collapse a multi-wiggle renderingType to the ggplot2 geom it maps to. Order
// matters: 'linecenter' contains 'line', so it must be tested first.
function geomKind(renderingType: string): GeomKind {
  return renderingType.includes('scatter')
    ? 'point'
    : renderingType.includes('linecenter')
      ? 'line'
      : renderingType.includes('line')
        ? 'step'
        : 'area'
}

export interface MultiWiggleRParams {
  trackId: string
  trackName: string
  // visible sources in display order, each resolved to a file uri + color
  sources: { name: string; uri: string; color: string }[]
  renderingType: string
  isOverlay: boolean
  /** The display's own height in px — what the panel's height is scaled from. */
  heightPx: number
}

// Pixels of display height per unit of `heightWeight` (one unit is ~2 inches of
// the emitted figure, see assembleRScript).
const PX_PER_HEIGHT_WEIGHT = 60

// The figure's own row pitch in pixels, below which a per-source axis label is
// noise rather than information. Derived from the emitted figure's geometry
// rather than from a number written here, so changing the ggsave() size retunes
// this with it instead of silently leaving it wrong.
const MIN_LABELLED_ROW_PX = 10
const FIGURE_PX_PER_WEIGHT = FIGURE_INCHES_PER_WEIGHT * FIGURE_DPI

// How tall this panel gets, from the DISPLAY's pixel height rather than from its
// source count. That is what JBrowse does — a multi-wiggle is always
// fit-to-height (`effectiveRowHeight = getRowHeight(height, numSources)`), so a
// 104-sample cohort in a 420px lane overplots into 4px rows instead of claiming
// 104 rows of its own. Claiming one row each is how a 2504-sample copy-number
// cohort came to ask ggsave() for a 5008-inch figure.
function heightWeightFor(p: MultiWiggleRParams) {
  return Math.max(1, Math.round(p.heightPx / PX_PER_HEIGHT_WEIGHT))
}

/**
 * Pure builder for the R ggplot panel of a multi-wiggle track. Reads every
 * subtrack with the inline `read_multibigwig()` helper into one long data.frame
 * (a `source` column), then either overlays the sources in one panel (colored
 * by source) or stacks them with `facet_grid(rows = vars(source))` for the
 * multi-row modes. Density is a per-source viridis strip heatmap. Pure ggplot2 +
 * inline helpers, no bespoke package. `read_regions()` reads each region in the
 * view onto one cumulative-bp x-axis (JBrowse's multi-region view); the shared
 * axis + dividers come from plot_regions(). Line-like geoms group by
 * (source, .region) so a line never connects across a region gap.
 */
export function multiWiggleFragment(p: MultiWiggleRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const urisVar = `${pathVar}_uris`
  const namesVar = `${pathVar}_names`
  const data = `read_regions(function(chrom, start, end) read_multibigwig(${urisVar}, ${namesVar}, chrom, start, end), regions, c("start", "end"))`
  const palette = `c(${p.sources
    .map(s => `${rName(s.name)} = ${rStr(s.color)}`)
    .join(', ')})`
  const isDensity = p.renderingType.includes('density')
  const facet = p.isOverlay ? '' : 'facet_grid(rows = vars(source)) +\n  '
  const heightWeight = heightWeightFor(p)

  let body: string
  if (isDensity) {
    // Per-source viridis strip, stacked on ONE continuous y axis rather than in
    // one facet each. A facet per source is the same picture for 4 sources and
    // an impossible one for 2504: each facet is a bare 0..1 strip, so the facet
    // machinery buys nothing here, while the continuous axis lets the rows
    // compress and overplot exactly as the browser's does.
    //
    // `match(source, <names>)` is the source's index in display order, so the
    // rows keep the order the display (and any clustering it did) put them in
    // rather than ggplot's alphabetical factor order.
    const rowPx = (heightWeight * FIGURE_PX_PER_WEIGHT) / p.sources.length
    const labelled = rowPx >= MIN_LABELLED_ROW_PX
    body = `geom_rect(aes(xmin = start, xmax = end,
    ymin = match(source, ${namesVar}) - 1L, ymax = match(source, ${namesVar}), fill = score)) +
  scale_fill_viridis_c() +
  scale_y_reverse(${labelled ? `breaks = seq_along(${namesVar}) - 0.5, labels = ${namesVar}, ` : ''}expand = c(0, 0)) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL, fill = "Score") +
  theme_minimal() +
  theme(${labelled ? 'axis.text.y = element_text(size = 4)' : 'axis.text.y = element_blank(), axis.ticks.y = element_blank()'})`
  } else {
    const geom = geomKind(p.renderingType)
    const usesFill = geom === 'area'
    const geomExpr = {
      area: `geom_area(aes(x = start, y = score, fill = source, group = interaction(source, .region)), position = "identity"${p.isOverlay ? ', alpha = 0.4' : ''})`,
      step: 'geom_step(aes(x = start, y = score, color = source, group = interaction(source, .region)))',
      line: 'geom_line(aes(x = start, y = score, color = source, group = interaction(source, .region)))',
      point:
        'geom_point(aes(x = start, y = score, color = source), size = 0.6)',
    }[geom]
    const scaleFn = usesFill ? 'scale_fill_manual' : 'scale_color_manual'
    // overlay keeps a source legend; multi-row labels each row via the facet
    // strip, so the color scale's own guide is redundant there
    const scaleExpr = p.isOverlay
      ? `${scaleFn}(values = ${palette}, name = NULL)`
      : `${scaleFn}(values = ${palette}, guide = "none")`
    const stripTheme = p.isOverlay
      ? ''
      : ' +\n  theme(strip.text.y = element_text(angle = 0))'
    body = `${geomExpr} +
  ${scaleExpr} +
  ${facet}labs(title = ${rStr(p.trackName)}, x = NULL, y = "Score") +
  theme_minimal()${stripTheme}`
  }

  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['rtracklayer', 'ggplot2'],
    helpers: ['read_multibigwig'],
    setup: `${urisVar} <- c(${p.sources.map(s => rStr(s.uri)).join(', ')})
${namesVar} <- c(${p.sources.map(s => rStr(s.name)).join(', ')})`,
    plotVariable: `p_${pathVar}`,
    heightWeight,
    plotExpr: `ggplot(${data}) +
  ${body}`,
  }
}

/** Read the multi-wiggle display's visible sources + styling into an R fragment. */
export function exportRCode(
  self: MultiLinearWiggleDisplayModel,
): RTrackFragment | undefined {
  const { trackId, trackName, adapter } = getTrackRMeta<MultiAdapterConf>(self)
  const uriByName = buildSourceUriMap(adapter)
  const sources = self.sources.flatMap(s => {
    const uri = uriByName.get(s.name)
    return uri ? [{ name: s.name, uri, color: s.color ?? self.posColor }] : []
  })
  return sources.length > 0
    ? multiWiggleFragment({
        trackId,
        trackName,
        sources,
        renderingType: self.renderingType,
        isOverlay: self.isOverlay,
        heightPx: self.height,
      })
    : undefined
}
