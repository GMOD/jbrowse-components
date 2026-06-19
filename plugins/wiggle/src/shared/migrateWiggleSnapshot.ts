/**
 * Migrates old wiggle snapshot properties to flat config keys.
 *
 * Handles two generations of old property names:
 *
 * Generation 1 (SharedWiggleMixin):
 *   rendererTypeNameState / selectedRendering, scale, autoscale,
 *   summaryScoreMode, constraints.{min,max}, color, posColor, negColor,
 *   showSidebar, fill (false → scatter rendering), minSize
 *
 * Generation 2 (*Setting suffix):
 *   colorSetting, posColorSetting, negColorSetting, scaleTypeSetting,
 *   minScoreSetting, maxScoreSetting, renderingTypeSetting,
 *   summaryScoreModeSetting, autoscaleSetting, showTreeSetting
 *
 * Gen2 takes precedence over Gen1 when both are present.
 *
 * Also handles the old WiggleRenderer `bicolorPivot` (a stringEnum of
 * numeric/mean/z_score/none paired with a separate numeric `bicolorPivotValue`)
 * collapsing into the current numeric `bicolorPivot`. Without this an old
 * `bicolorPivot: 'numeric'` string lands on the new number slot and throws on
 * hydration. mean/z_score/none have no numeric equivalent and fall back to the
 * default.
 */

// fill:false was "no fill / scatter mode" on xyplot-type renderers. Maps to
// the explicit scatter rendering types added in the current codebase.
const SCATTER_EQUIVALENT: Partial<Record<string, string>> = {
  xyplot: 'scatter',
  multixyplot: 'multiscatter',
  multirowxy: 'multirowscatter',
}

// fill:false meant "scatter" for xyplot-family renderers. Resolve against the
// known rendering, or the family default when no rendering was stored.
function scatterEquivalent(
  rendering: string | undefined,
  multiWiggle: boolean,
): string | undefined {
  const base = rendering ?? (multiWiggle ? 'multirowxy' : 'xyplot')
  return SCATTER_EQUIVALENT[base] ?? rendering
}

// Empty-string rendering values are a legacy "no selection" sentinel; treat
// them as absent so they fall back to the config-default rendering instead of
// becoming an invalid '' defaultRendering override (which throws "Unknown
// wiggle rendering type:" and leaves the display stuck loading).
function asRendering(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function filterDefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  )
}

export interface WiggleMigrateOpts {
  multiWiggle?: boolean
}

export function migrateWiggleSnapshot(
  snap: Record<string, unknown>,
  opts?: WiggleMigrateOpts,
) {
  const {
    rendererTypeNameState,
    selectedRendering,
    scale,
    autoscale: autoscaleGen1,
    summaryScoreMode: summaryScoreModeGen1,
    constraints,
    showSidebar,
    fill,
    color: colorGen1,
    posColor: posColorGen1,
    negColor: negColorGen1,
    minSize: _minSize,
    colorSetting,
    posColorSetting,
    negColorSetting,
    scaleTypeSetting,
    minScoreSetting,
    maxScoreSetting,
    renderingTypeSetting,
    summaryScoreModeSetting,
    autoscaleSetting,
    showTreeSetting,
    bicolorPivot,
    bicolorPivotValue,
    // clipColor was a WiggleRenderer slot with no display-config equivalent
    clipColor: _clipColor,
    ...rest
  } = snap

  // Old renderer: bicolorPivot was an enum; 'numeric' meant "use
  // bicolorPivotValue". New config: bicolorPivot is itself the numeric pivot.
  const bicolorPivotNumeric =
    asNumber(bicolorPivot) ??
    (bicolorPivot === 'numeric' ? asNumber(bicolorPivotValue) : undefined)

  const multiWiggle = opts?.multiWiggle ?? false
  const oldRendering =
    asRendering(rendererTypeNameState) ?? asRendering(selectedRendering)
  const resolvedRendering =
    asRendering(renderingTypeSetting) ??
    (multiWiggle && oldRendering === 'xyplot' ? 'multixyplot' : oldRendering)

  const defaultRendering =
    fill === false
      ? scatterEquivalent(resolvedRendering, multiWiggle)
      : resolvedRendering

  const effectiveColor = colorSetting ?? colorGen1
  // Old sessions used '#f0f'/'#ff00ff' as a sentinel meaning "bicolor mode".
  // Migrate to an explicit useBicolor flag; strip the sentinel from color.
  const isSentinelColor =
    effectiveColor === '#f0f' || effectiveColor === '#ff00ff'

  const overrides = filterDefined({
    defaultRendering,
    scaleType: scaleTypeSetting ?? scale,
    autoscale: autoscaleSetting ?? autoscaleGen1,
    summaryScoreMode: summaryScoreModeSetting ?? summaryScoreModeGen1,
    minScore: asNumber(minScoreSetting) ?? asNumber(asRecord(constraints)?.min),
    maxScore: asNumber(maxScoreSetting) ?? asNumber(asRecord(constraints)?.max),
    color: isSentinelColor ? undefined : effectiveColor,
    useBicolor: isSentinelColor
      ? true
      : effectiveColor !== undefined
        ? false
        : undefined,
    posColor: posColorSetting ?? posColorGen1,
    negColor: negColorSetting ?? negColorGen1,
    showTree: showTreeSetting ?? showSidebar,
    bicolorPivot: bicolorPivotNumeric,
  })

  return { ...rest, ...overrides }
}
