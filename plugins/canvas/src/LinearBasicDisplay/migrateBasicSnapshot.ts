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

// New name wins if both are present.
function renameLegacyColorKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const { color1, color2, color3, outline, ...result } = obj
  const setIfAbsent = (key: string, legacyVal: unknown) => {
    if (result[key] === undefined && legacyVal !== undefined) {
      result[key] = legacyVal
    }
  }
  setIfAbsent('color', color1)
  setIfAbsent('connectorColor', color2)
  setIfAbsent('utrColor', color3)
  setIfAbsent('outlineColor', outline)
  return result
}

export function migrateBasicConfigSnapshot(snap: Record<string, unknown>) {
  const result = renameLegacyColorKeys(liftRendererProps(snap))
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
  if (result.autoHeight !== undefined) {
    if (result.autoHeight && result.heightMode === undefined) {
      result.heightMode = 'grow'
    }
    delete result.autoHeight
  }
  // `maxHeight` was a second grow ceiling, dead at its default;
  // `growMaxHeight` is the one grow clamp.
  delete result.maxHeight
  return result
}
