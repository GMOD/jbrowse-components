import { hoverVariantSurface } from './variantSurface.ts'

import type { VariantTooltipFields } from './buildVariantHit.ts'
import type { VariantSurface } from './variantSurface.ts'

// `getHit` returns a fresh object per frame, so a surface that wrote it
// unconditionally would re-render the tooltip on every coalesced pointer frame
// for a cell that never changed. The dedup is keyed off the model's own hover
// slot, so a click that clears the hover leaves nothing stale to compare with.
function fields(over: Partial<VariantTooltipFields>) {
  return {
    name: 'HG002',
    genotype: '0|1',
    featureId: 'v1',
    ...over,
  } as VariantTooltipFields
}

function makeModel() {
  const calls: (VariantTooltipFields | undefined)[] = []
  return {
    calls,
    hoveredFeature: undefined as VariantTooltipFields | undefined,
    setHoveredFeature(g?: VariantTooltipFields) {
      this.hoveredFeature = g
      calls.push(g)
    },
    clearHoveredFeature() {},
    selectFeature() {},
    openContextMenu() {},
  }
}

function surfaceOf(hit: VariantTooltipFields | undefined) {
  const hovered: (VariantTooltipFields | undefined)[] = []
  const surface: VariantSurface<VariantTooltipFields> & {
    hovered: typeof hovered
  } = {
    hovered,
    getHit: () => (hit ? { ...hit } : undefined),
    getTooltip: h => h,
    enrich: () => undefined,
    onHover: h => {
      hovered.push(h)
    },
  }
  return surface
}

test('a repeated hit writes the tooltip once', () => {
  const model = makeModel()
  const surface = surfaceOf(fields({}))
  hoverVariantSurface(model, surface, 10, 10)
  hoverVariantSurface(model, surface, 11, 10)
  expect(model.calls).toHaveLength(1)
  expect(surface.hovered).toHaveLength(1)
})

test('a hit naming another sample writes again', () => {
  const model = makeModel()
  hoverVariantSurface(model, surfaceOf(fields({})), 10, 10)
  hoverVariantSurface(model, surfaceOf(fields({ name: 'HG003' })), 10, 10)
  expect(model.calls).toHaveLength(2)
  expect(model.hoveredFeature?.name).toBe('HG003')
})

test('leaving the hit clears both the tooltip and the surface highlight', () => {
  const model = makeModel()
  hoverVariantSurface(model, surfaceOf(fields({})), 10, 10)
  const empty = surfaceOf(undefined)
  hoverVariantSurface(model, empty, 10, 10)
  expect(model.hoveredFeature).toBeUndefined()
  expect(empty.hovered).toEqual([undefined])
})
