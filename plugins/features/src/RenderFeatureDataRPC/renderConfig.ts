import { readConfigValue as coreReadConfigValue } from '@jbrowse/core/configuration'
import { IDENTITY_SCALE } from '@jbrowse/core/util/colorScale'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'

import {
  SUBFEATURE_LABEL_PLACEMENTS,
  subfeatureLabelsOf,
} from './displayModes.ts'
import {
  FEATURE_DESCRIPTION_FIELD,
  FEATURE_NAME_FIELD,
} from './featureNameField.ts'
import { DEFAULT_TOOLTIP } from './featureTooltip.ts'

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

/**
 * `itemRgbOn` is present only under an identity scale, the track declaring its
 * features' colors their own as UCSC's `itemRgb on` does, so "0,0,0" paints
 * black.
 */
export type WorkerColor = Pick<ColorSetting, 'value' | 'field'> & {
  itemRgbOn?: true
}

/** The share of a color object the worker reads. */
export function workerColorOf({
  value,
  field,
  scale,
}: {
  value?: ColorSetting['value']
  field?: string
  scale?: { type?: string }
}): WorkerColor {
  return {
    value,
    field: field ?? '',
    ...(scale?.type === IDENTITY_SCALE ? { itemRgbOn: true } : {}),
  }
}

/**
 * The field the gene category filters by: true for a gene-like top-level
 * feature (`geneTypeTest`).
 */
export const GENE_LIKE_FIELD = 'geneLike'

// Fully enumerated — no index signature, so a typo on any property is a type
// error rather than silently typing as `unknown`.
export interface DisplayConfig {
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
  // The members a box reads: its value, the field whose values it ships, and
  // whether "0,0,0" is black. The scale is otherwise the main thread's, so a
  // recolor never refetches.
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

function member(source: unknown, key: string): unknown {
  return typeof source === 'object' && source !== null
    ? Reflect.get(source, key)
    : undefined
}

function memberAt(source: unknown, path: string[]) {
  return path.reduce(member, source)
}

function stringAt(source: unknown, path: string[], fallback: string) {
  const value = memberAt(source, path)
  return typeof value === 'string' ? value : fallback
}

function optionalStringAt(source: unknown, path: string[]) {
  const value = memberAt(source, path)
  return typeof value === 'string' ? value : undefined
}

function numberAt(source: unknown, path: string[], fallback: number) {
  const value = memberAt(source, path)
  return typeof value === 'number' ? value : fallback
}

function stringsAt(source: unknown, path: string[], fallback: string[]) {
  const value = memberAt(source, path)
  return Array.isArray(value) && value.every(v => typeof v === 'string')
    ? value
    : fallback
}

function isFieldPredicate(value: unknown): value is FieldPredicate {
  return typeof member(value, 'field') === 'string'
}

function placementOf(value: unknown) {
  return SUBFEATURE_LABEL_PLACEMENTS.find(p => p === value)
}

function subfeatureLabelsAt(snapshot: unknown) {
  const show = memberAt(snapshot, ['labels', 'subfeatures', 'show'])
  const placement = placementOf(
    memberAt(snapshot, ['labels', 'subfeatures', 'placement']),
  )
  return typeof show === 'boolean' && placement !== undefined
    ? subfeatureLabelsOf({ show, placement })
    : GENE_GLYPH_DEFAULTS.subfeatureLabels
}

function filterAt(snapshot: unknown) {
  const value = memberAt(snapshot, ['filter'])
  return Array.isArray(value) ? value.filter(isFieldPredicate) : []
}

/**
 * Picks exactly the slots `SettingsDisplayConfig` declares out of the
 * everything-snapshot. A slot the display does not declare takes the schema's
 * default, the gene half from `GENE_GLYPH_DEFAULTS`. Picking rather than
 * excluding keeps an unrelated slot write — `height` on every resize-drag
 * frame — out of the RPC cache key. The label fields alone: the `show`
 * switches are the main thread's, so a label toggle never refetches.
 */
export function pickDisplayConfig(
  snapshot: Record<string, unknown>,
): SettingsDisplayConfig {
  return {
    subfeatureLabels: subfeatureLabelsAt(snapshot),
    transcriptTypes: stringsAt(
      snapshot,
      ['transcripts', 'types'],
      GENE_GLYPH_DEFAULTS.transcriptTypes,
    ),
    canonicalTranscriptField: stringAt(
      snapshot,
      ['transcripts', 'field'],
      GENE_GLYPH_DEFAULTS.canonicalTranscriptField,
    ),
    canonicalTranscriptTags: stringsAt(
      snapshot,
      ['transcripts', 'sort'],
      GENE_GLYPH_DEFAULTS.canonicalTranscriptTags,
    ),
    containerTypes: stringsAt(
      snapshot,
      ['containers', 'types'],
      GENE_GLYPH_DEFAULTS.containerTypes,
    ),
    tooltip: stringAt(snapshot, ['tooltip', 'field'], DEFAULT_TOOLTIP),
    filter: filterAt(snapshot),
    featureHeight: numberAt(
      snapshot,
      ['mark', 'height'],
      DEFAULT_FEATURE_HEIGHT,
    ),
    color: workerColorOf({
      value: optionalStringAt(snapshot, ['encoding', 'color', 'value']),
      field: optionalStringAt(snapshot, ['encoding', 'color', 'field']),
      scale: {
        type: optionalStringAt(snapshot, [
          'encoding',
          'color',
          'scale',
          'type',
        ]),
      },
    }),
    utrColor: optionalStringAt(snapshot, [
      'utrs',
      'encoding',
      'color',
      'value',
    ]),
    labels: {
      name: stringAt(snapshot, ['labels', 'name', 'field'], FEATURE_NAME_FIELD),
      description: stringAt(
        snapshot,
        ['labels', 'description', 'field'],
        FEATURE_DESCRIPTION_FIELD,
      ),
    },
  }
}
