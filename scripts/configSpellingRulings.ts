import type { Ruling } from './configSpellingShapes.ts'

const VALUE_ONLY_WIDTH =
  'a wiggle row draws its points or line at one width, so WiggleSize is `value` alone (wiggleSizeConfigSchema.ts)'

/**
 * Why each path in CONFIG_SPELLINGS.md's first table differs between
 * displays or parts, the ADR or schema comment that rules on it, and how
 * many shapes it has. `open` states a difference nothing rules on yet.
 */
export const RULINGS: Record<string, Ruling> = {
  data: {
    variants: 2,
    why: "`normalization` is Hi-C's own, the old `selectedNormalization` (ADR-238)",
  },
  'data.resolution': {
    variants: 2,
    why: 'one word, three meanings, one per family: stored tier, points per pixel, binsize steps (ADR-238, kept 2026-10-27)',
  },
  encoding: {
    variants: 4,
    why: 'a display declares the channels it draws, and no channel adds a lane (ADR-238)',
  },
  'encoding.color': {
    variants: 4,
    why: "LD and Hi-C paint through MatrixRampMixin's ramp, which has no constant (ldColorConfigSchema.ts, hicColorConfigSchema.ts); a UTR takes a `value` alone (ADR-238); a bases layer declares a `field` alone",
  },
  'encoding.color.legend': {
    variants: 3,
    why: "a color object declares `descending` only where its key reads it (colorConfigSchema.ts), so Hi-C and MAF take `title` alone and wiggle builds its own key (wiggleColorConfigSchema.ts); `values` and `missingLabel` are the mark display's (ADR-178)",
  },
  'encoding.color.scale': {
    variants: 7,
    why: "each color object declares the scale members its painter reads (colorConfigSchema.ts): a chord paints only discrete scales (chordColorConfigSchema.ts); Hi-C's and LD's ramp is built from `scheme` and `reverse` alone (hicColorConfigSchema.ts, ldColorConfigSchema.ts); wiggle's ramp spans the y domain (wiggleColorConfigSchema.ts); each MAF field has one scale (mafColorConfigSchema.ts); ribbons take the synteny views' scale, whose open end is a widening span with no values to rank, so no `domainQuantile` (syntenyColorConfigSchema.ts, ADR-179)",
  },
  'encoding.color.scale.type': {
    variants: 7,
    why: "a scale's `type` lists the scales its display paints (colorConfigSchema.ts's `colorScaleTypeSlot`): a chord the discrete ones, LD a ramp or threshold, Hi-C a continuous ramp, each in its color schema's comment",
  },
  'encoding.opacity': {
    variants: 2,
    why: 'a chord takes one alpha (chordOpacityConfigSchema.ts); mismatches and ribbons read a field through a scale',
  },
  'encoding.opacity.scale': {
    variants: 2,
    why: 'the mismatch fade is one linear ramp over four uniforms, so no `type` or `domain` (ADR-240)',
  },
  'encoding.size': { variants: 2, why: VALUE_ONLY_WIDTH },
  'encoding.strokeWidth': { variants: 2, why: VALUE_ONLY_WIDTH },
  'encoding.strokeWidth.scale': {
    variants: 2,
    why: 'read connections map one read to 44 on a fixed domain (readConnectionsStrokeWidthConfigSchema.ts, ADR-240)',
  },
  'encoding.y': {
    variants: 4,
    why: "`encoding.y` is the value-axis channel (ADR-238): wiggle's holds its plotted `field` beside `scale`, `axis` and `rules`; the mark display's has no `field`, each mark's bare `y` naming it, and a coverage band's has none either; MAF's holds `field` alone, its only value scale being `coverage.encoding.y` (mafYConfigSchema.ts)",
  },
  facet: {
    variants: 3,
    why: "`transform`, steps run per section, is the mark display's MarkFacet (markFacetConfigSchema.ts); the variant display's top-level facet is the sample facet (ADR-254, ADR-255), and a row display's facet reads no hidden band (sectionFacetConfigSchema.ts)",
  },
  heightMode: {
    variants: 2,
    why: "LD and Hi-C draw a triangle, whose height is its base's, so no `grow` (TriangleMatrixMixin.ts)",
  },
  labels: {
    variants: 6,
    why: "each display names the label parts it draws: LD a variant name, features `description` and `subfeatures`, multi-way its `lanes` (ADR-238); the records band a record's name and description (recordsBandConfigSchema.ts); sashimi its read counts, a text layer with `show` (ADR-240, sashimiLabelsConfigSchema.ts). `rows.labels`, the row axis's name-to-text map, and `rows.axis.labels`, its draw toggle, are another thing sharing the word (ADR-257)",
  },
  'labels.name': {
    variants: 2,
    why: 'an LD SNP carries only its id, so there is no `field` (configSchemaLDTrack.ts)',
  },
  mark: {
    variants: 6,
    why: "each mark object holds what its glyph reads (ADR-238): a chord's `depth`; a feature's, a record's and a read's box `height` (featureMarkConfigSchema.ts, ADR-255, ADR-240) and MAF's alignments rect its `height` band (ADR-194); read connections' `type` alone (ADR-240); a `marks` entry's MarkDef (markDefConfigSchema.ts); wiggle's `type`, `interpolate` and `extent` (wiggleMarkConfigSchema.ts); a ribbon's `interpolate` alone (syntenyMarkConfigSchema.ts)",
  },
  'mark.height': {
    variants: 2,
    why: "a feature's, a record's and a read's box is px tall (featureMarkConfigSchema.ts, ADR-240, ADR-255); a rect standing in a band takes Vega-Lite's `{ band }`, a fraction of it, on the mark display and MAF's alignments (ADR-194)",
  },
  'mark.interpolate': {
    variants: 3,
    why: '`interpolate` is the one curve word (ADR-238) and each mark lists the curves it draws: a `marks` entry in markDefConfigSchema.ts, a wiggle line in wiggleMarkConfigSchema.ts, a ribbon in syntenyMarkConfigSchema.ts',
  },
  'mark.type': {
    variants: 3,
    why: 'each mark object lists the types its display draws: read connections a `link` or a `rule` (ADR-240); a `marks` entry every built mark (markDefConfigSchema.ts); wiggle `bar`, `line`, `point` and `rect` (wiggleMarkConfigSchema.ts)',
  },
  pileup: {
    variants: 2,
    why: 'a synteny block has no basecaller tags or qualities, so no `bases` layer (LGVSyntenyDisplay/readsOnlySlots.test.ts)',
  },
  placement: {
    variants: 4,
    why: "one word, two meanings: a band draws `up` over coverage or `down` below it, with `auto` on sashimi alone among the bands (ADR-231); a label sits `above`, `below` or as an `overlay`, or `auto` on a feature's parts, the part labels and the multi-way lane names each listing their own (ADR-238)",
  },
  rows: {
    variants: 5,
    why: "`step` where rows scroll, `groups` on the mark family, `filter` and `field` where rows carry attributes, so not MAF or the lanes (ADR-257); `annotations` on `Rows` (ADR-260); multi-way's rows are its lanes, which keep `kept`, `labels` and `sort` alone (ADR-257)",
  },
  'rows.axis': {
    variants: 2,
    why: 'MAF draws no row separators, so no `grid` (ADR-238)',
  },
  tooltip: {
    variants: 3,
    why: 'alignments take a field-only tooltip (ADR-240); the variant display splits `show` from `records.tooltip.field` (ADR-254, ADR-255)',
  },
}
