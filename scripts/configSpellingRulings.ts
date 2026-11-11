const VALUE_ONLY_WIDTH =
  'a wiggle row draws its points or line at one width, so WiggleSize is `value` alone (wiggleSizeConfigSchema.ts)'

interface Ruling {
  variants: number
  why: string
}

/**
 * Why each path in CONFIG_SPELLINGS.md's first table differs between
 * displays or parts, the ADR or schema comment that rules on it, and how
 * many shapes it has. `open:` marks a difference nothing rules on yet.
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
    why: "each color object declares the scale members its painter reads (colorConfigSchema.ts): a chord paints only discrete scales (chordColorConfigSchema.ts); Hi-C's and LD's ramp is built from `scheme` and `reverse` alone (hicColorConfigSchema.ts, ldColorConfigSchema.ts); wiggle's ramp spans the y domain (wiggleColorConfigSchema.ts); each MAF field has one scale (mafColorConfigSchema.ts). open: ribbons take the synteny views' scale (syntenyColorConfigSchema.ts), which has no `domainQuantile`",
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
    why: 'the mismatch fade is one linear ramp over four uniforms, so no `type` or `domain`, and `clamp` (ADR-240). open: the synteny scale always clamps and has no member for it',
  },
  'encoding.size': { variants: 2, why: VALUE_ONLY_WIDTH },
  'encoding.strokeWidth': { variants: 2, why: VALUE_ONLY_WIDTH },
  'encoding.strokeWidth.scale': {
    variants: 2,
    why: 'read connections map one read to 44 on a fixed domain (readConnectionsStrokeWidthConfigSchema.ts, ADR-240)',
  },
  'encoding.y': {
    variants: 4,
    why: "`encoding.y` is the value-axis channel (ADR-238): wiggle's holds its plotted `field` beside `scale`, `axis` and `rules`; the mark display's and the coverage bands' have no `field`, each mark's bare `y` naming it; MAF's holds `field` alone, its only value scale being `coverage.encoding.y` (mafYConfigSchema.ts)",
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
    variants: 3,
    why: 'each display names the label parts it draws: LD a variant name, features `description` and `subfeatures`, multi-way its `lanes` (ADR-238)',
  },
  'labels.name': {
    variants: 2,
    why: 'an LD SNP carries only its id, so there is no `field` (configSchemaLDTrack.ts)',
  },
  mark: {
    variants: 3,
    why: "a chord's `mark.depth` and wiggle's mark object of `type`, `interpolate` and `extent` (ADR-238, wiggleMarkConfigSchema.ts) and a feature's `mark.height` are each display's own mark properties",
  },
  pileup: {
    variants: 2,
    why: 'a synteny block has no basecaller tags or qualities, so no `bases` layer (LGVSyntenyDisplay/readsOnlySlots.test.ts)',
  },
  rows: {
    variants: 5,
    why: '`step` where rows scroll, `groups` on the mark family, `filter` and `field` where rows carry attributes, so not MAF or the lanes (ADR-257); `annotations` on `Rows` (ADR-260)',
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
