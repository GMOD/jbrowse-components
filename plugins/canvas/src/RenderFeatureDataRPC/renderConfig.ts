import { readConfigValue as coreReadConfigValue } from '@jbrowse/core/configuration'

import type { SubfeatureLabels } from './displayModes.ts'
import type { ResolvedConfigSnapshot } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// An unset displayMode inherits the session-wide type default (see getConf /
// promotable slots), which resolves to `normal`; every preset pins an explicit
// height.
export {
  DISPLAY_MODES,
  DISPLAY_MODE_OPTIONS,
  SUBFEATURE_LABELS,
  SUBFEATURE_LABEL_OPTIONS,
  isDisplayMode,
} from './displayModes.ts'
export type { DisplayMode, SubfeatureLabels } from './displayModes.ts'

// DisplayConfig-typed wrapper over the core reader. The core reader takes a
// `Record<string, unknown>` for generic config snapshots; the single cast here
// localizes that structural widening so every worker call site keeps the
// precisely-typed DisplayConfig (and its property typos stay type errors).
export function readConfigValue<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
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
//
// `null` counts as no value, alongside `undefined`. An attribute present but
// empty is null rather than undefined — a VCF INFO key, a JSON `null` — and
// jexl hands it straight back, so `mouseover` rendered the word "null" over the
// feature and a color slot returned it as a color.
export function readConfigValueSafe<T>(
  config: DisplayConfig,
  key: string | string[],
  feature: Feature,
  jexl: JexlInstance,
  fallback: T,
): T {
  try {
    const value = readConfigValue<T>(config, key, feature, jexl)
    return value ?? fallback
  } catch {
    return fallback
  }
}

// Sentinel config color meaning "derive from the theme". The worker recognizes
// it and emits the OUTLINE color class rather than a color, because it has no
// palette to resolve one from (see colorClasses.ts). Only outlineColor still
// needs a sentinel: that slot has three states (no outline / theme-derived /
// explicit color) and just one spare non-color value (`''` = off), so the third
// has to be in-band. Slots with only a theme-derived default use `maybeColor`
// instead — see configurationSlot.ts.
export const THEME_DERIVED_COLOR = '#f0f'

// Fully-enumerated — no `[key: string]: unknown` index signature, so a typo on
// any property is a type error rather than silently typing as `unknown`. The
// widening to `Record<string, unknown>` that the core config reader wants is
// confined to the readConfigValue wrapper above.
export interface DisplayConfig {
  // displayMode is NOT sent to the worker — compact/superCompact height scaling
  // is applied on the main thread, so switching modes skips an RPC round-trip.
  // Track height is not sent either: the fit ladder trims isoforms where it can
  // see the packing (ADR-092).
  geneGlyphMode: 'auto' | 'all' | 'longestCoding'
  subfeatureLabels: SubfeatureLabels
  transcriptTypes: string[]
  // the attribute an isoform's curated "represents the gene" tag rides in, and
  // the values of it that count — `rankIsoforms` puts a tagged isoform ahead of
  // every other one, so it is what `longestCoding` shows and what the height
  // cap keeps first
  canonicalTranscriptField: string
  canonicalTranscriptTags: string[]
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
  // the built-in NCBI source-record gate in buildFeatureAdmission; not a jexl
  // filter, so it never reaches the "Filter by..." dialog
  hideSourceFeatures: boolean
  // `number | string`, not `number`, because the slot declares
  // `contextVariable: ['feature']` — so it may hold a `jexl:` expression, exactly
  // like `color`/`utrColor`/`mouseover` beside it. Typing it as a bare number is
  // what let layout read the expression straight into a Float32Array and paint a
  // track of NaN-height boxes. Read it through `featureHeightPx`, which resolves
  // the callback and guards the result; the union makes any new direct read a
  // type error rather than a silent one.
  featureHeight: number | string
  // `maybeColor` slots: undefined = unset, meaning the feature's own BED color
  // paints it (see getBoxColor). Not the same as any concrete color.
  color: string | undefined
  connectorColor: string | undefined
  utrColor: string | undefined
  outlineColor: string
  labels: {
    name: string
    description: string
  }
}

// One `true` per slot the worker reads — the runtime spelling of the interface
// above, so `rpcProps()` can build its payload by PICKING what the worker reads
// instead of dropping what it doesn't.
//
// A `Record<keyof DisplayConfig, true>` is exhaustive in BOTH directions with no
// helper: tsc errors on a key this omits, naming it, and on a name that is not a
// `DisplayConfig` key. So the list cannot drift from the interface, which is the
// only reason it is safe for it to exist at all.
// `geneGlyphMode` is the one worker-read slot NOT picked here: what the worker
// gets is the zoom-resolved mode, added at the RPC call site the way the
// per-base bin is, so a crossing of its `auto` threshold is the display's
// `zoomFetchKey` moving rather than a settings invalidation.
export type SettingsDisplayConfig = Omit<DisplayConfig, 'geneGlyphMode'>

const WORKER_READS: Record<keyof SettingsDisplayConfig, true> = {
  subfeatureLabels: true,
  transcriptTypes: true,
  canonicalTranscriptField: true,
  canonicalTranscriptTags: true,
  containerTypes: true,
  subParts: true,
  impliedUTRs: true,
  displayDirectionalChevrons: true,
  mouseover: true,
  jexlFilters: true,
  hideSourceFeatures: true,
  featureHeight: true,
  color: true,
  connectorColor: true,
  utrColor: true,
  outlineColor: true,
  labels: true,
}

const DISPLAY_CONFIG_KEYS = Object.keys(
  WORKER_READS,
) as (keyof SettingsDisplayConfig)[]

/**
 * The worker's half of a display config snapshot: exactly the slots
 * `DisplayConfig` declares, dropped out of the everything-snapshot
 * `getConfigSnapshotWithPromotables` returns.
 *
 * **Additive on purpose, and that is the whole point.** The snapshot carries
 * every slot the display's schema and its inherited bases declare, and the
 * payload it feeds is the RPC cache key (`rpcPropsCacheKey` = `JSON.stringify`
 * of it) — so under the subtractive spelling this replaced, a slot named neither
 * in `DisplayConfig` nor in a hand-kept exclusion list became a silent refetch
 * trigger. `height` did: the resize handle writes it on every drag frame
 * (TrackContainer -> resizeHeight -> setConf), so dragging a track taller re-ran
 * the whole worker pipeline. Ten names had accumulated in that list, and the
 * ones that mattered most were inherited from `BaseLinearDisplay`'s schema
 * rather than written in this plugin, where nobody adding one would think to
 * look.
 *
 * Picking inverts the failure: a new slot is invisible to the worker until it
 * joins `DisplayConfig`, and forgetting means the feature does not work — which
 * someone notices — rather than every unrelated config write refetching the
 * track, which nobody does.
 *
 * The assertion is the mirror of `readConfigValue`'s at the top of this file —
 * the same `Record<string, unknown>` round trip, in the other direction — and
 * what it stands on is different from what the `as DisplayConfig` it replaced
 * stood on: there, an unchecked superset; here, a key list the compiler proved
 * complete.
 *
 * **`ResolvedConfigSnapshot`, not `Record<string, unknown>`**, and that is the
 * half the key list cannot prove. `DisplayConfig` declares
 * `displayDirectionalChevrons: boolean` and `featureHeight: number | string`,
 * and the pick asserts them — so handing this a RAW snapshot compiles, ships
 * `undefined` for every promotable slot, and types it as the resolved value.
 * Only `getConfigSnapshotWithPromotables` produces the branded type, so the raw
 * spelling no longer typechecks here.
 */
export function pickDisplayConfig(snapshot: ResolvedConfigSnapshot) {
  const picked: Record<string, unknown> = {}
  for (const key of DISPLAY_CONFIG_KEYS) {
    picked[key] = snapshot[key]
  }
  return picked as unknown as SettingsDisplayConfig
}
