import { getFeatureName } from './labelUtils.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The `mouseover` slot's default. `function` (the INSDC/GFF3 qualifier) comes
 * before the id fallback, so hovering a feature with no name, an NCBI viral
 * `stem_loop` say, shows its descriptor rather than a bare id; `get()`, since
 * `function` is reserved.
 */
export const DEFAULT_MOUSEOVER = `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`

/**
 * `DEFAULT_MOUSEOVER` as the function it spells, which the worker calls for
 * every feature where the slot is left at its default: through jexl it cost
 * a third of a single-span track's emit pass, whoever hovered
 * (`benches/featureTooltip.bench.ts`).
 */
export function defaultMouseover(feature: Feature) {
  const value: unknown =
    feature.get('_mouseOver') ||
    feature.get('name') ||
    feature.get('function') ||
    feature.get('id')
  return String(value ?? getFeatureName(feature) ?? '')
}
