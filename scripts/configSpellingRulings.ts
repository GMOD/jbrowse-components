const OWN_CHANNELS =
  "a display's or part's `encoding` holds the channels it draws (ADR-238)"

const VALUE_ONLY_WIDTH =
  'a wiggle row draws its points or line at one width, so WiggleSize is `value` alone (its schema comment)'

/**
 * Why each path in CONFIG_SPELLINGS.md's first table differs between
 * displays or parts: the ADR or schema comment that rules on it. `open:`
 * marks a difference nothing rules on yet.
 */
export const RULINGS: Record<string, string> = {
  data: "`normalization` is Hi-C's own, the old `selectedNormalization` (ADR-238)",
  'data.resolution':
    'one word, three meanings, one per family: stored tier, points per pixel, binsize steps (ADR-238, kept 2026-10-27)',
  encoding: OWN_CHANNELS,
  'encoding.color':
    "LD and Hi-C paint a statistic through a ramp with no constant (LDColor's comment); a bases layer is a `field` alone and UTRs a `value` alone",
  'encoding.color.legend':
    "wiggle builds its own key and Hi-C and MAF take a `title` alone (each schema's `legend` comment); `values` and `missingLabel` are the mark display's (ADR-178)",
  'encoding.color.scale':
    'each display declares the members its painter reads (ADR-108, colorConformance.test.ts). open: ribbons take the synteny views scale, which has no `domainQuantile`',
  'encoding.color.scale.type':
    'each display declares the scale types it paints (ADR-108)',
  'encoding.opacity':
    'a chord takes one alpha (ChordOpacity); mismatches and ribbons read a field through a scale',
  'encoding.opacity.scale':
    'the mismatch fade is a fixed ramp with `clamp` (ADR-240). open: the synteny scale always clamps and has no member for it',
  'encoding.size': VALUE_ONLY_WIDTH,
  'encoding.strokeWidth': VALUE_ONLY_WIDTH,
  'encoding.strokeWidth.scale':
    'read connections map one read to 44 on a fixed domain (the `scale` comment in readConnectionsStrokeWidthConfigSchema.ts, ADR-240)',
  'encoding.y':
    "a mark's `y` is its field and the display's `y` holds the axis and scale, a bare string refused there (ADR-238); MAF's `y` is `identity` or unset (MafY)",
  facet:
    "`transform` is the mark display's (ADR-130); the variant display's top-level facet is the sample facet, which reads no hidden band (SectionFacet's comment)",
  heightMode:
    "LD and Hi-C draw a triangle, whose height is its base's, so no `grow` (TriangleMatrixMixin.ts)",
  labels:
    'each display names the label parts it draws: LD a variant name, features `description` and `subfeatures`, multi-way its `lanes` (ADR-238)',
  'labels.name':
    "an LD SNP carries only its id, so there is no `field` (configSchemaLDTrack.ts's `labels.name` comment)",
  mark: "a chord's `depth`, a feature's `height` and wiggle's mark `type` are each display's own mark properties (ADR-227 for wiggle)",
  pileup:
    'a synteny block has no basecaller tags or qualities, so no `bases` layer (LGVSyntenyDisplay/readsOnlySlots.test.ts)',
  rows: "`Rows` adds `field`, `filter`, `step`, `groups` and `annotations` to the shared arrangement per display (ADR-157, ADR-257, ADR-260); multi-way's rows are its lanes",
  'rows.axis': 'MAF draws no row separators, so no `grid` (ADR-238)',
  tooltip:
    'alignments take a field-only tooltip (ADR-240); the variant display splits `show` from `records.tooltip.field` (ADR-254, ADR-255)',
}
