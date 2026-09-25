import { readConfigValue as coreReadConfigValue } from '@jbrowse/core/configuration'

import type { SubfeatureLabels } from './displayModes.ts'
import type { Feature } from '@jbrowse/core/util'
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
// attribute as null, which a color slot or `mouseover` would otherwise paint.
export function readConfigValueSafe<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
  fallback: T,
): T {
  try {
    const value = coreReadConfigValue<T>(
      config as unknown as Record<string, unknown>,
      key,
      feature,
      jexl,
    )
    return value ?? fallback
  } catch {
    return fallback
  }
}

// Sentinel config color meaning "derive from the theme". Only outlineColor needs
// one: that slot has three states (no outline / theme-derived / explicit color)
// and just one spare non-color value (`''` = off), so the third rides in-band.
// The main thread resolves it against the palette at render time, so the slot
// is not a worker input and toggling it refetches nothing.
export const THEME_DERIVED_COLOR = '#f0f'

export type WorkerColor = Pick<ColorSetting, 'value' | 'field'>

/** The share of a colour object the worker reads: its value, and its field. */
export function workerColorOf({
  value,
  field,
}: Partial<Pick<ColorSetting, 'value' | 'field'>>): WorkerColor {
  return { value, field: field ?? '' }
}

// Fully enumerated — no index signature, so a typo on any property is a type
// error rather than silently typing as `unknown`.
export interface DisplayConfig {
  // displayMode is NOT sent to the worker: the main thread applies
  // compact/superCompact height scaling, so switching modes skips an RPC
  // round-trip. Track height is not sent either — the fit ladder trims isoforms
  // where it can see the packing.
  geneGlyphMode: 'auto' | 'all' | 'longestCoding'
  // The `facetField` each feature's `groupKey` is stamped from; absent for a
  // strand facet, which the stamped strand answers without a refetch.
  facetField?: string
  subfeatureLabels: SubfeatureLabels
  transcriptTypes: string[]
  canonicalTranscriptField: string
  canonicalTranscriptTags: string[]
  containerTypes: string[]
  subParts: string
  impliedUTRs: boolean
  mouseover: string
  // The raw config slot omits the `jexl:` prefix and the runtime "Filter by..."
  // override carries it; buildFeatureAdmission normalizes both.
  jexlFilters: string[]
  // Not a jexl filter, so it never reaches the "Filter by..." dialog.
  hideSourceFeatures: boolean
  // `number | string` because the slot declares `contextVariable: ['feature']`
  // and so may hold a `jexl:` expression. Read it through `featureHeightPx`; the
  // union makes any new direct read a type error rather than a Float32Array full
  // of NaN.
  featureHeight: number | string
  // The two members a box reads: its value, and the field whose values it
  // ships. The scale is the main thread's, so a recolor never refetches.
  color: WorkerColor
  // `maybeColor` slots, as `color.value`.
  connectorColor: string | undefined
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

// A `Record<keyof SettingsDisplayConfig, true>` is exhaustive in both
// directions, so this list cannot drift from the interface.
const WORKER_READS: Record<keyof SettingsDisplayConfig, true> = {
  subfeatureLabels: true,
  transcriptTypes: true,
  canonicalTranscriptField: true,
  canonicalTranscriptTags: true,
  containerTypes: true,
  subParts: true,
  impliedUTRs: true,
  mouseover: true,
  jexlFilters: true,
  hideSourceFeatures: true,
  featureHeight: true,
  color: true,
  connectorColor: true,
  utrColor: true,
  labels: true,
}

const DISPLAY_CONFIG_KEYS = Object.keys(
  WORKER_READS,
) as (keyof SettingsDisplayConfig)[]

/**
 * The half of the worker's settings that shapes a multi-part glyph. Only the
 * feature display declares these as slots; a display drawing single records
 * (the variant display, the variant lane) sends these values.
 */
export type GeneGlyphSettings = Pick<
  SettingsDisplayConfig,
  | 'subfeatureLabels'
  | 'transcriptTypes'
  | 'canonicalTranscriptField'
  | 'canonicalTranscriptTags'
  | 'containerTypes'
  | 'subParts'
  | 'impliedUTRs'
  | 'hideSourceFeatures'
  | 'connectorColor'
  | 'utrColor'
>

export const GENE_GLYPH_DEFAULTS: GeneGlyphSettings = {
  subfeatureLabels: 'none',
  transcriptTypes: [
    'mRNA',
    'transcript',
    'primary_transcript',
    'V_gene_segment',
    'C_gene_segment',
    'D_gene_segment',
    'J_gene_segment',
  ],
  canonicalTranscriptField: 'tag',
  canonicalTranscriptTags: [
    'MANE Select',
    'MANE_Select',
    'RefSeq Select',
    'Ensembl_canonical',
    'MANE Plus Clinical',
    'MANE_Plus_Clinical',
  ],
  containerTypes: ['proteoform_orf'],
  subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
  impliedUTRs: true,
  hideSourceFeatures: true,
  connectorColor: undefined,
  utrColor: undefined,
}

/**
 * Picks exactly the slots `DisplayConfig` declares out of the
 * everything-snapshot, the gene half from `GENE_GLYPH_DEFAULTS` where the
 * display declares none. Picking rather than excluding keeps an unrelated slot
 * write — `height` on every resize-drag frame — out of the RPC cache key.
 */
export function pickDisplayConfig(snapshot: Record<string, unknown>) {
  const source: Record<string, unknown> = {
    ...GENE_GLYPH_DEFAULTS,
    ...snapshot,
  }
  const picked: Record<string, unknown> = {}
  for (const key of DISPLAY_CONFIG_KEYS) {
    picked[key] = source[key]
  }
  picked.color = workerColorOf(source.color ?? {})
  return picked as unknown as SettingsDisplayConfig
}
