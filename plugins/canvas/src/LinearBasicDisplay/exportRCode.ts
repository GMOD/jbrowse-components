import { getConf } from '@jbrowse/core/configuration'
import {
  firstUri,
  getTrackRMeta,
  rDataVariable,
  rStr,
  safeVarName,
} from '@jbrowse/plugin-linear-genome-view'

import type { LinearBasicDisplayModel } from './model.ts'
import type { RTrackFragment } from '@jbrowse/plugin-linear-genome-view'

interface AdapterConf {
  gffGzLocation?: { uri?: string }
  gffLocation?: { uri?: string }
  bedGzLocation?: { uri?: string }
  bedLocation?: { uri?: string }
  // BigBedAdapter's slot. Its `uri` shorthand is rewritten into this by the
  // schema's preProcessSnapshot, so by the time a config reaches here the
  // shorthand is gone — reading only the four above emitted `path <- ""` for
  // every BigBed feature track, and the script died in R on "path cannot be an
  // empty string". Every UCSC-hub track is a BigBed, so that was most of them.
  bigBedLocation?: { uri?: string }
  uri?: string
}

/** One translated `jexlFilters` entry: an attribute compared to a literal. */
export interface FeatureFilterRule {
  attr: string
  op: '==' | '!='
  value: string
  /** The expression it was translated from, emitted beside the R predicate. */
  jexl: string
}

/**
 * The two shapes a feature filter is actually written in — `get(feature,'x')`
 * (the deferred-evaluation form the config slot and the "Filter by..." dialog
 * use, and the only one that works for a reserved-word attribute) and the
 * `feature.x` sugar. Both compared to a quoted literal with == or !=.
 */
const FILTER_FORMS = [
  /^get\(\s*feature\s*,\s*['"]([^'"]+)['"]\s*\)\s*(==|!=)\s*['"]([^'"]*)['"]$/,
  /^feature\.([A-Za-z_]\w*)\s*(==|!=)\s*['"]([^'"]*)['"]$/,
]

/**
 * Translate a display's active jexl filters into attribute comparisons the R
 * `feature_filter()` helper can apply, keeping the ones it cannot parse so the
 * caller can say so in the script rather than drop them in silence.
 *
 * A general jexl evaluator in R is not the goal (the alignments export takes
 * the same line with "Filter by": translate the structured settings, name what
 * is left). What matters is that the shape every track carries by default —
 * `get(feature,'gbkey')!='Src'` — makes it across, because that one is the
 * difference between the browser's picture and a figure with a
 * whole-chromosome NCBI source record drawn across it.
 */
export function translateFeatureFilters(filters: string[]) {
  const rules: FeatureFilterRule[] = []
  const untranslated: string[] = []
  for (const filter of filters) {
    // the slot stores expressions without the `jexl:` prefix and activeFilters()
    // adds it back, so accept either
    const expr = filter.replace(/^jexl:/, '').trim()
    const match = FILTER_FORMS.map(re => re.exec(expr)).find(m => m !== null)
    if (match) {
      rules.push({
        attr: match[1]!,
        op: match[2] as '==' | '!=',
        value: match[3]!,
        jexl: expr,
      })
    } else if (expr) {
      untranslated.push(expr)
    }
  }
  return { rules, untranslated }
}

/**
 * One rule as a vectorized R predicate over the feature frame — the form
 * `feature_filter()` takes, and the form a reader can extend by writing another
 * `function(f) ...` into the list.
 *
 * The NA arm is jexl's `undefined` semantics, not defensiveness: a feature
 * without the attribute FAILS an `==` and PASSES a `!=`, which is what makes
 * the default gbkey filter a no-op on the (many) files that carry no gbkey.
 */
function rPredicate({ attr, op, value }: FeatureFilterRule) {
  // `f$gbkey` where the name is a plain R identifier, `f[["odd name"]]` else
  const col = /^[A-Za-z][\w.]*$/.test(attr) ? `f$${attr}` : `f[[${rStr(attr)}]]`
  return op === '=='
    ? `function(f) !is.na(${col}) & ${col} == ${rStr(value)}`
    : `function(f) is.na(${col}) | ${col} != ${rStr(value)}`
}

export interface GeneRParams {
  trackId: string
  trackName: string
  uri: string
  /**
   * Which reader parses the uri: read_gff, or read_bed in its plain-text or its
   * indexed-BigBed mode. Defaults to GFF3.
   */
  format?: 'gff' | 'bed' | 'bigbed'
  /** The display's active feature filters, already translated. */
  filters?: FeatureFilterRule[]
  /** Filters that did not translate; emitted as a comment, not applied. */
  untranslatedFilters?: string[]
  /** Under "Show only genes", the top-level types that pass; else undefined. */
  geneTypes?: string[]
  /**
   * Under geneGlyphMode "longest coding transcript", the child types that count
   * as a gene's isoforms; else undefined (draw every transcript).
   */
  collapseIsoforms?: string[]
}

// Rows the y-scale always covers, however few the packing needs. A glyph is
// drawn as a fixed fraction of ONE row (±0.35 for CDS), so a panel holding a
// single row had a y-range of 0.7 and drew that gene as a solid bar filling the
// whole panel — a 6 kb window over one hg38 gene came out as a featureless
// orange block. Padding the scale instead of shrinking the glyph keeps a dense
// panel unchanged: the floor is a no-op the moment the track packs 4 rows.
const MIN_GLYPH_ROWS = 4

// Packed rows per unit of patchwork height (one unit is ~2 inches of figure),
// and the floor below which a panel doesn't shrink. Calibrated so a typical gene
// panel — 8 or so rows — lands on the 2 it has always had, and only a track that
// packs deeper than that grows: the point is to stop a 61-row window of
// structural variants being squeezed into the same two inches as three genes,
// not to restyle every existing figure.
const PACKED_ROWS_PER_WEIGHT = 4
const MIN_HEIGHT_WEIGHT = 2

/**
 * Pure builder for the R panel of a feature/gene track, using plain ggplot2 (no
 * bespoke package): each top-level feature is a directional `geom_segment` body
 * line, its leaf subfeatures are `geom_rect` boxes — thin exons/UTRs OVER thick
 * CDS, keyed off the feature `type` so coding regions read like the browser
 * glyph — and rows come from the visible, swappable `gene_layout()` helper.
 *
 * The leaves go on top, hairlined in white, because of the one case where the
 * nesting is the whole point: a polyprotein's mature peptides tile their CDS
 * end to end, so drawn underneath it they were completely hidden, and drawn in
 * the same fill with no edge they would have merged into the single bar they
 * were hidden by. On an ordinary gene the two layers share a fill and the CDS
 * is the taller box, so the order is invisible there. GFF3
 * and BED both feed the same panel via read_gff / read_bed (identical schema).
 * `read_regions()` reads each region in the view onto one cumulative-bp x-axis
 * (features are cut at the region edge); the shared axis + dividers come from
 * plot_regions(). gene_layout runs over the combined regions so rows pack across
 * the whole figure.
 *
 * `feature_filter()` sits between the reader and the layout, reproducing the
 * display's own admission gate (config `jexlFilters` + "Show only genes"), so
 * the panel draws what the track draws rather than everything the file holds.
 */
export function geneFragment(p: GeneRParams): RTrackFragment {
  const pathVar = safeVarName(p.trackId)
  const reader = p.format === 'gff' || !p.format ? 'read_gff' : 'read_bed'
  // read_bed reads a .bb through BigBedSelection instead of parsing text; named
  // so it still follows an omitted `attrs`
  const formatArg = p.format === 'bigbed' ? ', format = "bigBed"' : ''
  const strandColors = 'c(`+` = "#5a9bd4", `-` = "#e8894a", `*` = "grey50")'
  const rules = p.filters ?? []
  const filtersVar = `${pathVar}_filters`
  const typesVar = `${pathVar}_types`
  // only the attributes a rule reads are pulled out of the GFF; an unreferenced
  // one would just be an unused all-NA column
  const attrs = [...new Set(rules.map(r => r.attr))]
  const attrsArg = attrs.length
    ? `, c(${attrs.map(a => rStr(a)).join(', ')})`
    : ''
  const read = `read_regions(function(chrom, start, end) ${reader}(${pathVar}, chrom, start, end${attrsArg}${formatArg}), regions, c("start", "end"))`
  const admitted = `feature_filter(${read}, ${filtersVar}, ${p.geneTypes ? typesVar : 'NULL'})`
  // "Longest coding transcript" collapses each gene to one isoform BEFORE the
  // packing, exactly where the display's glyph layout does it — collapsing
  // after would leave the dropped transcripts' rows reserved.
  const isoformVar = `${pathVar}_transcript_types`
  const shown = p.collapseIsoforms
    ? `collapse_isoforms(${admitted}, ${isoformVar})`
    : admitted
  const dataExpr = `gene_layout(${shown})`
  const plotVariable = `p_${pathVar}`
  const dataVariable = rDataVariable(plotVariable)

  // one `# <the jexl it came from>` / predicate pair per rule, so the reader can
  // see which browser setting each line is, and delete or add lines freely
  const entries = rules.map(r => `  # ${r.jexl}\n  ${rPredicate(r)}`)
  // an untranslated filter is named rather than dropped: the panel then differs
  // from the browser, and this is what says so and where to fix it
  const notes = (p.untranslatedFilters ?? []).map(
    f =>
      `# NOT TRANSLATED - jexl beyond an attribute comparison, so this panel draws\n# features the browser hides until you add it to the list above as R:\n#   ${f}`,
  )
  const setup = [
    `${pathVar} <- ${rStr(p.uri)}`,
    ``,
    `# What the track admits ("Filter by...", the jexlFilters config slot): each`,
    `# entry takes the feature frame and returns one logical per row. Empty the`,
    `# list to draw everything the file holds.`,
    `${filtersVar} <- list(${entries.length ? `\n${entries.join(',\n')}\n` : ''})`,
    ...notes,
    ...(p.geneTypes
      ? [
          `# "Show only genes": the top-level feature types that pass.`,
          `${typesVar} <- c(${p.geneTypes.map(t => rStr(t)).join(', ')})`,
        ]
      : []),
    ...(p.collapseIsoforms
      ? [
          `# "Longest coding transcript" (geneGlyphMode): the child types that`,
          `# count as isoforms to choose among. Delete the collapse_isoforms()`,
          `# call in the panel below to draw every transcript instead.`,
          `${isoformVar} <- c(${p.collapseIsoforms.map(t => rStr(t)).join(', ')})`,
        ]
      : []),
  ].join('\n')

  return {
    trackId: p.trackId,
    trackName: p.trackName,
    packages: ['rtracklayer', 'ggplot2'],
    helpers: [
      reader,
      'feature_filter',
      ...(p.collapseIsoforms ? ['collapse_isoforms'] : []),
      'gene_layout',
      'label_room',
    ],
    setup,
    plotVariable,
    // Bound rather than inlined so the height below can read it — and so a
    // reader can inspect the frame the panel drew.
    dataExpr,
    // Rows are only known once the file has been read and packed, so the panel
    // says how tall it is in R rather than taking the generator's guess. (The
    // opposite case — one row inflating to fill the panel — is expand_limits
    // below, since that one IS a constant.)
    heightWeightExpr: `max(${MIN_HEIGHT_WEIGHT}, max(c(${dataVariable}$row, 0), na.rm = TRUE) / ${PACKED_ROWS_PER_WEIGHT})`,
    plotExpr: `ggplot(${dataVariable}) +
  geom_segment(data = function(d) d[is.na(d$parent), ],
    aes(x = ifelse(strand == "-", end, start), xend = ifelse(strand == "-", start, end),
      y = row, yend = row, color = strand),
    linewidth = 0.3, arrow = arrow(length = unit(0.05, "inches"), type = "closed")) +
  geom_rect(data = function(d) d[d$type == "CDS", ],
    aes(xmin = start, xmax = end, ymin = row - 0.35, ymax = row + 0.35, fill = strand)) +
  geom_rect(data = function(d) d[!(d$fid %in% d$parent) & d$type != "CDS", ],
    aes(xmin = start, xmax = end, ymin = row - 0.18, ymax = row + 0.18, fill = strand),
    colour = "white", linewidth = 0.1) +
  geom_text(data = function(d) d[label_room(d, regions, fig_width_px), ],
    aes(x = (start + end) / 2, y = row + 0.5, label = name),
    size = 2.5, na.rm = TRUE, check_overlap = TRUE) +
  scale_fill_manual(values = ${strandColors}, guide = "none") +
  scale_color_manual(values = ${strandColors}, guide = "none") +
  scale_y_reverse() +
  expand_limits(y = ${MIN_GLYPH_ROWS}) +
  labs(title = ${rStr(p.trackName)}, x = NULL, y = NULL) +
  theme_minimal() +
  theme(axis.text.y = element_blank(), axis.ticks.y = element_blank())`,
  }
}

/**
 * The top-level types "Show only genes" admits, the same set featureAdmission
 * builds — the config's transcript/container type lists plus the three it hard
 * codes.
 */
function geneLikeTypes(self: LinearBasicDisplayModel) {
  return [
    ...getConf(self, 'transcriptTypes'),
    ...getConf(self, 'containerTypes'),
    'gene',
    'pseudogene',
    'CDS',
  ]
}

/** Read the feature track's source uri into an R gene-model panel. The reader is
 * decided by which adapter location is set (the `uri` shorthand falls back to a
 * filename check) so a BED or BigBed track is parsed as one, not misread as
 * GFF. */
export function exportRCode(
  self: LinearBasicDisplayModel,
): RTrackFragment | undefined {
  const { trackId, trackName, adapter } = getTrackRMeta<AdapterConf>(self)
  const gffUri = firstUri(adapter.gffGzLocation, adapter.gffLocation)
  const bedUri = firstUri(adapter.bedGzLocation, adapter.bedLocation)
  const bigBedUri = firstUri(adapter.bigBedLocation)
  const shorthand = adapter.uri ?? ''
  const uri = firstUri(gffUri, bedUri, bigBedUri, shorthand)
  // no path to read — a blob/handle location, or an adapter spelling its source
  // in a slot with no case here (a plain GtfAdapter). Decline the track rather
  // than emit `path <- ""`; exportR names it in the script instead.
  if (!uri) {
    return undefined
  }
  const unslotted = gffUri === '' && bedUri === '' && bigBedUri === ''
  const format =
    bigBedUri !== '' || (unslotted && /\.(bb|bigbed)$/i.test(shorthand))
      ? 'bigbed'
      : bedUri !== '' || (unslotted && /\.bed(\.gz)?$/i.test(shorthand))
        ? 'bed'
        : 'gff'
  const { rules, untranslated } = translateFeatureFilters(self.activeFilters())
  // the RESOLVED mode, not the raw slot: `auto` is the default, and it is the
  // view's zoom that decides what it means (bpPerPx > 100 collapses), so reading
  // the slot would draw every transcript on exactly the wide views the display
  // collapses
  const collapseIsoforms =
    self.effectiveGeneGlyphMode === 'longestCoding'
      ? getConf(self, 'transcriptTypes')
      : undefined
  return geneFragment({
    trackId,
    trackName,
    uri,
    format,
    filters: rules,
    untranslatedFilters: untranslated,
    geneTypes: self.showOnlyGenes ? geneLikeTypes(self) : undefined,
    collapseIsoforms,
  })
}
