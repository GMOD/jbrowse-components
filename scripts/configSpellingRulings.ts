import type { Ruling } from './configSpellingShapes.ts'

const VALUE_ONLY_WIDTH =
  'a wiggle row draws its points or line at one width, so its `size` and `strokeWidth` are both WiggleSize, `value` alone (wiggleSizeConfigSchema.ts)'

/**
 * Why each path in CONFIG_SPELLINGS.md's first table differs between
 * displays or parts, the ADR or schema comment that rules on it, and the
 * variants it rules on, each a variant's members or `=values` as
 * configSpellingShapes.ts keys them. `open` states a difference nothing
 * rules on yet.
 */
export const RULINGS: Record<string, Ruling> = {
  data: {
    shapes: ['resolution', 'normalization resolution'],
    why: "`normalization` is Hi-C's own, the old `selectedNormalization` (ADR-238)",
  },
  'data.resolution': {
    shapes: ['=auto =coarse =fine', ''],
    why: "one concept, how finely the data is read, in each family's unit: synteny's stored tier, wiggle's points per pixel, Hi-C's binsize steps from the zoom's pick (ADR-238, kept 2026-10-27)",
  },
  encoding: {
    shapes: ['color opacity', 'color', 'color y', 'color size strokeWidth y'],
    why: "a display declares the channels it draws (ADR-238): `y` where it plots a value, MAF's a row's bar height; `opacity` on a chord; wiggle's `size` and `strokeWidth`",
  },
  'encoding.color': {
    shapes: [
      'field legend scale value',
      'field legend scale',
      'field',
      'value',
    ],
    why: "LD and Hi-C paint through MatrixRampMixin's ramp, which has no constant (ldColorConfigSchema.ts, hicColorConfigSchema.ts); a UTR takes a `value` alone (ADR-238); a bases layer declares a `field` alone",
  },
  'encoding.color.legend': {
    shapes: [
      'descending title',
      'title',
      'descending missingLabel title values',
    ],
    why: "a color object declares `descending` only where its key reads it (colorConfigSchema.ts), so Hi-C and MAF take `title` alone and wiggle builds its own key (wiggleColorConfigSchema.ts); `values` and `missingLabel` are the mark display's (ADR-178)",
  },
  'encoding.color.scale': {
    shapes: [
      'domain invalid names range reverse scheme type unknown',
      'domain domainMax domainMid domainMin range reverse scheme type',
      'domain domainMax domainMid domainMin domainQuantile invalid names range reverse scheme type unknown',
      'domainMax domainMid domainMin domainQuantile reverse scheme type',
      'domain domainMax domainMid domainMin names range reverse scheme',
      'domain domainMid names range reverse scheme type',
      'domain domainMax domainMid domainMin invalid names range reverse scheme type unknown',
    ],
    why: "each color object declares the scale members its painter reads (colorConfigSchema.ts): a chord paints only discrete scales (chordColorConfigSchema.ts); Hi-C's ramp takes its colors from `scheme` and `reverse` alone, its open top following `domainQuantile` (hicColorConfigSchema.ts); LD's spans the statistic's fixed 0 to 1, so no `domainQuantile`, and a threshold adds `domain` cuts and `range` colors (ldColorConfigSchema.ts); wiggle's ramp spans the y domain (wiggleColorConfigSchema.ts); each MAF field has one scale (mafColorConfigSchema.ts); ribbons take the synteny views' scale, whose open end is a widening span with no values to rank, so no `domainQuantile` (syntenyColorConfigSchema.ts, ADR-179)",
  },
  'encoding.color.scale.type': {
    shapes: [
      '=ordinal =threshold',
      '=linear =threshold',
      '=linear =ordinal =threshold',
      '=identity =linear =log =ordinal =symlog =threshold',
      '=linear =log =symlog',
      '=linear =log =ordinal =symlog =threshold',
    ],
    why: "a scale's `type` lists the scales its display's painter reads (`colorScaleTypeSlot`): `identity` only where the painter reads a feature's own color (colorScale.ts), so not the multi-way gene, read or ribbon painters; a chord the discrete ones (chordColorConfigSchema.ts); alignments, synteny ribbons and LD ramp only linearly (bakedColorScale.ts, colorRamps.ts `rampNorm`, ldUniforms.slang), and wiggle's ramp takes the y scale's type (wiggleColorConfigSchema.ts), so none offers `log` or `symlog`; Hi-C a ramp alone, binning no cells as LD's `paintedCells` does (LDDisplay/model.ts); LD's fields are numbers and wiggle's `source` takes the rows' colors, so neither writes `ordinal`",
  },
  'encoding.opacity': {
    shapes: ['value', 'field scale value'],
    why: 'a chord takes one alpha (chordOpacityConfigSchema.ts); mismatches and ribbons read a field through a scale',
  },
  'encoding.opacity.scale': {
    shapes: [
      'domainMax domainMin range',
      'domain domainMax domainMin range type',
    ],
    why: 'the mismatch fade is one linear ramp over four uniforms, so no `type` or `domain` (ADR-240)',
  },
  'encoding.size': {
    shapes: ['field scale value', 'value'],
    why: VALUE_ONLY_WIDTH,
  },
  'encoding.strokeWidth': {
    shapes: ['field scale value', 'value'],
    why: VALUE_ONLY_WIDTH,
  },
  'encoding.strokeWidth.scale': {
    shapes: ['range type', 'domainMax domainMin range type'],
    why: 'read connections map `reads` over a fixed domain, one read to 44, past which more reads add no width, so no `domainMin` or `domainMax` (readConnectionsStrokeWidthConfigSchema.ts, arcLineWidth.ts, ADR-240)',
  },
  'encoding.y': {
    shapes: ['axis rules scale', 'field', '', 'axis field rules scale'],
    why: "`encoding.y` is the value-axis channel (ADR-238): wiggle's holds its plotted `field` beside `scale`, `axis` and `rules`; the mark display's has no `field`, each mark's bare `y` naming it, and a coverage band's has none either; MAF's holds `field` alone, its only value scale being `coverage.encoding.y` (mafYConfigSchema.ts)",
  },
  facet: {
    shapes: ['field hidden sort', 'field hidden sort transform', 'field sort'],
    why: "`transform`, steps run per section, is the mark display's MarkFacet (markFacetConfigSchema.ts); the variant display's top-level facet is the sample facet, which bands its rows with no chip to hide one, so no `hidden` (facetConfigSchema.ts, ADR-254, ADR-255)",
  },
  heightMode: {
    shapes: ['=fit =fixed', '=fit =fixed =grow'],
    why: "LD and Hi-C draw a triangle, whose height is its base's, so no `grow` (TriangleMatrixMixin.ts)",
  },
  labels: {
    shapes: [
      'name',
      'show',
      'description name subfeatures',
      '',
      'description name',
      'lanes name',
    ],
    why: "each display names the label parts it draws: LD a variant name, features `description` and `subfeatures`, multi-way its `lanes` (ADR-238); the records band a record's name and description (recordsBandConfigSchema.ts); junctions its read counts, a text layer with `show` (ADR-240, junctionLabelsConfigSchema.ts). `rows.labels`, the row axis's name-to-text map, and `rows.axis.labels`, its draw toggle, are another thing sharing the word (ADR-257)",
  },
  'labels.name': {
    shapes: ['show', 'field show'],
    why: 'an LD SNP carries only its id, so there is no `field` (configSchemaLDTrack.ts)',
  },
  mark: {
    shapes: [
      'depth',
      'height',
      'type',
      'gapBp height interpolate type',
      'extent interpolate type',
      'interpolate',
    ],
    why: "each mark object holds what its glyph reads (ADR-238): a chord's `depth`; a feature's, a record's and a read's box `height` (featureMarkConfigSchema.ts, ADR-255, ADR-240) and MAF's alignments rect its `height` band (ADR-194); read connections' `type` alone (ADR-240); a `marks` entry's MarkDef (markDefConfigSchema.ts); wiggle's `type`, `interpolate` and `extent` (wiggleMarkConfigSchema.ts); a ribbon's `interpolate` alone (syntenyMarkConfigSchema.ts)",
  },
  'mark.height': {
    shapes: ['', 'band'],
    why: "a feature's, a record's and a read's box is px tall (featureMarkConfigSchema.ts, ADR-240, ADR-255); a rect standing in a band takes Vega-Lite's `{ band }`, a fraction of it, on the mark display and MAF's alignments (ADR-194)",
  },
  'mark.interpolate': {
    shapes: ['=arc =dome =linear =step', '=linear =step', '=bump =linear'],
    why: '`interpolate` is the one curve word (ADR-238) and each mark lists the curves it draws: a `marks` entry in markDefConfigSchema.ts, a wiggle line in wiggleMarkConfigSchema.ts, a ribbon in syntenyMarkConfigSchema.ts',
  },
  'mark.type': {
    shapes: [
      '=link =rule',
      '=bar =line =link =point =rect =rule =text',
      '=bar =line =point =rect',
    ],
    why: 'each mark object lists the types its display draws: read connections a `link` or a `rule` (ADR-240); a `marks` entry every built mark (markDefConfigSchema.ts); wiggle `bar`, `line`, `point` and `rect` (wiggleMarkConfigSchema.ts)',
  },
  pileup: {
    shapes: [
      'collapsed connectors fadeLowFrequency mark maxLayoutHeight mismatches show softclips',
      'bases collapsed connectors fadeLowFrequency mark maxLayoutHeight mismatches show softclips',
    ],
    why: 'a synteny block has no basecaller tags or qualities, so no `bases` layer (LGVSyntenyDisplay/readsOnlySlots.test.ts)',
  },
  placement: {
    shapes: [
      '=above =below =overlay',
      '=above =auto =below =overlay',
      '=auto =below =overlay',
      '=above =overlay',
    ],
    why: "where a thing sits against its anchor, each holder listing the positions it draws: an arc band `above`, `below` or as an `overlay` on coverage, `auto` on junctions alone sending a junction below where it would cross another (ADR-272); a part label under or over its part's row, its `auto` naming only a polyprotein's cleavage products (featureSubfeatureLabelsConfigSchema.ts, ADR-238); a lane header above its genes or over its gene row (ADR-238)",
  },
  rows: {
    shapes: [
      'axis color colors kept labels sort tree',
      'annotations axis color colors field filter groups kept labels sort step subtitle tree',
      'annotations axis color colors field filter kept labels sort step subtitle tree',
      'annotations axis color colors field filter kept labels sort subtitle tree',
      'colors field kept labels sort',
    ],
    why: "`step` where rows scroll and `groups` on the mark family (ADR-257); `field`, `filter`, `annotations` and `subtitle` are `Rows`', whose rows are a field's values carrying attributes, so not MAF's RowArrangement (ADR-257, ADR-260, ADR-279); multi-way's rows are its lanes: a `field` picking genome or copy lanes (ADR-278), a `kept` that selects and can add a lane where a row display's narrows, and no tree, axis or row color (laneRowsConfigSchema.ts)",
  },
  'rows.axis': {
    shapes: [
      'branchLength labels tree width',
      'branchLength grid labels tree width',
    ],
    why: 'MAF draws no row separators, so no `grid` (ADR-238)',
  },
  tooltip: {
    shapes: ['field', 'field show', 'show'],
    why: 'alignments take a field-only tooltip (ADR-240); the variant display splits `show` from `records.tooltip.field` (ADR-254, ADR-255)',
  },
}
