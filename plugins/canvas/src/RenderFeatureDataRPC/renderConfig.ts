import { readConfigValue as coreReadConfigValue } from '@jbrowse/core/configuration'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// DisplayConfig-typed wrapper over the core reader. The core reader takes a
// `Record<string, unknown>` for generic config snapshots; the single cast here
// localizes that structural widening so every worker call site keeps the
// precisely-typed DisplayConfig (and its property typos stay type errors).
export function readConfigValue<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl?: JexlInstance,
): T {
  return coreReadConfigValue<T>(
    config as unknown as Record<string, unknown>,
    key,
    feature,
    jexl,
  )
}

// Evaluate a (possibly `jexl:`) config slot against a feature, degrading to
// `fallback` when the expression throws — e.g. a custom `mouseover`/`labels`
// jexl referencing a missing plugin function or reading an attribute off a
// feature that doesn't carry it. The legacy SVG renderer evaluated these lazily
// on the main thread on hover, so a bad expression only broke that one tooltip;
// here every feature is evaluated up front in the worker, so an unguarded throw
// would fail the entire track render.
export function readConfigValueSafe<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance | undefined,
  fallback: T,
): T {
  try {
    const value = readConfigValue<T>(config, key, feature, jexl)
    return value === undefined ? fallback : value
  } catch {
    return fallback
  }
}

// Sentinel config color (connectorColor stroke, outlineColor) meaning "derive
// from the theme". The worker swaps it for `fallback` via resolveThemeColor.
export const THEME_DERIVED_COLOR = '#f0f'

export function resolveThemeColor(value: string, fallback: string) {
  return value === THEME_DERIVED_COLOR ? fallback : value
}

export type DisplayMode =
  | 'normal'
  | 'compact'
  | 'superCompact'
  | 'reducedRepresentation'
  | 'collapse'

// Fully-enumerated — no `[key: string]: unknown` index signature, so a typo on
// any property is a type error rather than silently typing as `unknown`. The
// widening to `Record<string, unknown>` that the core config reader wants is
// confined to the readConfigValue wrapper above.
export interface DisplayConfig {
  // displayMode is NOT sent to the worker — compact/superCompact scaling and
  // collapse-mode label decimation are applied on the main thread so switching
  // modes skips an RPC round-trip.
  geneGlyphMode: 'auto' | 'all' | 'longestCoding'
  subfeatureLabels: 'none' | 'below' | 'overlay'
  transcriptTypes: string[]
  containerTypes: string[]
  subParts: string
  impliedUTRs: boolean
  displayDirectionalChevrons: boolean
  // hover tooltip slot — raw `jexl:...` string (or a plain string), evaluated
  // per-feature in the worker
  mouseover: string
  // feature-admission filters — jexl expression strings. The raw config slot
  // omits the `jexl:` prefix (deferred-evaluation convention); the runtime
  // "Filter by..." override carries it. buildFeatureAdmission normalizes both.
  jexlFilters: string[]
  featureHeight: number
  color: string
  connectorColor: string
  utrColor: string
  outlineColor: string
  labels: {
    name: string
    description: string
  }
}
