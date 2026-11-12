import { readConfigValue as coreReadConfigValue } from '@jbrowse/core/configuration'
import { IDENTITY_SCALE, identityFieldOf } from '@jbrowse/core/util/colorScale'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'

import type { SubfeatureLabels } from './displayModes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

export {
  DISPLAY_MODES,
  DISPLAY_MODE_OPTIONS,
  SUBFEATURE_LABELS,
  SUBFEATURE_LABEL_OPTIONS,
  isDisplayMode,
} from './displayModes.ts'
export type { DisplayMode, SubfeatureLabels } from './displayModes.ts'

// The worker evaluates every feature up front, so an unguarded throw from a bad
// jexl expression would fail the entire track render. `null` degrades to
// `fallback` alongside `undefined`: jexl hands back a present-but-empty
// attribute as null, which a color slot would otherwise paint.
export function readConfigValueSafe<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
  fallback: T,
): T {
  try {
    const value = coreReadConfigValue<T>(config, key, feature, jexl)
    return value ?? fallback
  } catch {
    return fallback
  }
}

interface WrittenColor {
  value?: ColorSetting['value']
  field?: string
  scale?: { type?: string }
}

/**
 * `itemRgbOn` is present only under an identity scale, the track declaring its
 * features' colors their own as UCSC's `itemRgb on` does, so "0,0,0" paints
 * black. `identityField` is present only where `identityFieldOf` names one,
 * since `field` may be a parked field shipping its values, which never paints.
 */
export type WorkerColor = Pick<ColorSetting, 'value' | 'field'> & {
  itemRgbOn?: true
  identityField?: string
}

/** The share of a color object the worker reads. */
export function workerColorOf(color: WrittenColor): WorkerColor {
  const identityField = identityFieldOf(color)
  return {
    value: color.value,
    field: color.field ?? '',
    ...(color.scale?.type === IDENTITY_SCALE ? { itemRgbOn: true } : {}),
    ...(identityField === undefined ? {} : { identityField }),
  }
}

/**
 * The field the gene category filters by: true for a gene-like top-level
 * feature (`geneTypeTest`).
 */
export const GENE_LIKE_FIELD = 'geneLike'

// Fully enumerated — no index signature, so a typo on any property is a type
// error rather than silently typing as `unknown`.
export type DisplayConfig = {
  // displayMode is NOT sent to the worker: the main thread applies
  // compact/superCompact height scaling, so switching modes skips an RPC
  // round-trip. Track height is not sent either — the fit ladder trims isoforms
  // where it can see the packing.
  geneGlyphMode: 'auto' | 'all' | 'representative'
  // The `facetField` each feature's `groupKey` is stamped from; absent for a
  // strand facet, which the stamped strand answers without a refetch.
  facetField?: string
  subfeatureLabels: SubfeatureLabels
  transcriptTypes: string[]
  canonicalTranscriptField: string
  canonicalTranscriptTags: string[]
  containerTypes: string[]
  // `tooltip.field`, flat here
  tooltip: string
  // the display's `filter` list, its `jexl:` fields as written
  filter: FieldPredicate[]
  // `mark.height`, flat here
  featureHeight: number
  // The members a box reads: its value, the field whose values it ships,
  // whether "0,0,0" is black, and the field an identity scale paints. The
  // scale is otherwise the main thread's, so a recolor never refetches.
  color: WorkerColor
  // `maybeColor` slots, as `color.value`.
  utrColor: string | undefined
  labels: {
    name: string
    description: string
  }
}

// The config slots the worker reads. `geneGlyphMode` reaches it resolved
// against the zoom through the display's `zoomFetchArgs`, and `facetField` is
// the facet's rather than a slot.
export type SettingsDisplayConfig = Omit<
  DisplayConfig,
  'geneGlyphMode' | 'facetField'
>

/**
 * The half of the worker's settings that shapes a multi-part glyph. Only the
 * feature display declares these as slots; a display drawing single records
 * (the variant display) sends these values.
 */
export type GeneGlyphSettings = Pick<
  SettingsDisplayConfig,
  | 'subfeatureLabels'
  | 'transcriptTypes'
  | 'canonicalTranscriptField'
  | 'canonicalTranscriptTags'
  | 'containerTypes'
  | 'utrColor'
>

export const GENE_GLYPH_DEFAULTS: GeneGlyphSettings = {
  subfeatureLabels: 'auto',
  transcriptTypes: [
    'mRNA',
    'transcript',
    'primary_transcript',
    'V_gene_segment',
    'C_gene_segment',
    'D_gene_segment',
    'J_gene_segment',
  ],
  canonicalTranscriptField: DEFAULT_CANONICAL_TRANSCRIPTS.field,
  canonicalTranscriptTags: [...DEFAULT_CANONICAL_TRANSCRIPTS.tags],
  containerTypes: ['proteoform_orf'],
  utrColor: undefined,
}

export const DEFAULT_FEATURE_HEIGHT = 10
