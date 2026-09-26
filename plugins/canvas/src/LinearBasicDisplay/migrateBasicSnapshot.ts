import { applyRetiredSpellings } from '@jbrowse/core/configuration'

import { legacyGeneGlyphMode } from './geneGlyphMode.ts'
import { legacyShowLabelsToMode } from './showLabelsMode.ts'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function liftRendererProps(
  snap: Record<string, unknown>,
): Record<string, unknown> {
  const { renderer, ...rest } = snap
  if (!isRecord(renderer)) {
    // `rest` already excludes `renderer`, so a stray `renderer: null` is
    // dropped rather than carried into the snapshot.
    return rest
  }
  const {
    type: _rendererType,
    height: rendererHeight,
    ...rendererProps
  } = renderer
  // `renderer.height` was the feature body's height, now `featureHeight`;
  // lifting it by name would set a v4 config's track height to ~10px. Snap
  // props win, so renderer spreads first.
  return {
    ...rendererProps,
    ...(rendererHeight !== undefined
      ? { featureHeight: rendererHeight }
      : undefined),
    ...rest,
  }
}

// The removed `reducedRepresentation` and `collapse` values map to `normal`
// so old configs pass the narrowed enum.
function normalizeDisplayMode(value: unknown) {
  return value === 'reducedRepresentation' || value === 'collapse'
    ? 'normal'
    : value
}

/**
 * The v4 names whose value moves to one current slot unchanged. Declared rather
 * than folded into the pass below so they are lifted with the retired display
 * types, before the `displayDefaults` shorthand merges into the entry: a
 * `color1` the entry spells has to beat a `color` the shorthand carries, and it
 * cannot while it is still spelt `color1` when the two merge.
 */
export const basicRetired = {
  color1: (color: unknown) => ({ color }),
  color2: (connectorColor: unknown) => ({ connectorColor }),
  color3: (utrColor: unknown) => ({ utrColor }),
  outline: (outlineColor: unknown) => ({ outlineColor }),
  // v4's grow toggle, whose `false` was the default and becomes nothing
  autoHeight: (value: unknown) => (value ? { heightMode: 'grow' } : {}),
  // a second grow ceiling, dead at its default; `growMaxHeight` is the one
  maxHeight: () => ({}),
}

export function migrateBasicConfigSnapshot(snap: Record<string, unknown>) {
  // `basicRetired` again, because the renderer lift above uncovers the same v4
  // names one level down: `renderer: { color1 }` is a `color1` no earlier pass
  // could see.
  const result = applyRetiredSpellings(
    'LinearBasicDisplay',
    basicRetired,
    liftRendererProps(snap),
  )
  // A unified-enum value already present wins over a stale `showDescriptions`
  // beside it, so a re-saved config is not rewritten.
  const legacyShowLabels =
    typeof result.showLabels === 'boolean' ||
    result.showLabels === 'on' ||
    result.showLabels === 'off'
  if (
    legacyShowLabels ||
    (result.showLabels === undefined && result.showDescriptions !== undefined)
  ) {
    result.showLabels = legacyShowLabelsToMode(
      result.showLabels,
      result.showDescriptions !== false,
    )
  }
  delete result.showDescriptions
  if (result.geneGlyphMode !== undefined) {
    result.geneGlyphMode = legacyGeneGlyphMode(result.geneGlyphMode)
  }
  if (result.displayMode !== undefined) {
    result.displayMode = normalizeDisplayMode(result.displayMode)
  }
  return result
}
