import { getConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { createTestEnvironment } from './testEnv.ts'

// Manhattan declares its own config slots rather than inheriting
// LinearWiggleDisplay's whole schema. Two things have to stay true for that to
// be safe, and neither is visible to the typechecker:
//
//  1. every slot the composed mixins still READ is declared — `getConf` answers
//     `undefined` for an undeclared slot instead of throwing, so a miss is a
//     silent wrong value rather than a crash;
//  2. the base-display slots survive the change of `baseConfiguration`.
describe('LinearManhattanDisplay config surface', () => {
  it('declares every slot its composed mixins read', () => {
    const { display } = createTestEnvironment().createDisplay()
    // ScoreScaleMixin. `scales.y` here is `linear` with no autoscale mode, so
    // the menu draws neither radio and both ends autoscale until pinned.
    expect(display.scaleType).toBe('linear')
    expect(display.scaleTypeChoices).toEqual(['linear'])
    expect(display.autoscaleType).toBeUndefined()
    expect(display.minScoreBound).toBeUndefined()
    expect(display.maxScoreBound).toBeUndefined()
    // ScoreFieldConfigMixin's remaining members
    expect(display.scoreField).toBe('score')
    expect(display.size).toBeGreaterThan(0)
    expect(display.showCrossHatches).toBe(false)
    expect(display.isDensityMode).toBe(false)
    expect(display.minimalTicks).toBe(false)
    expect(display.grid).toBe(false)
    // Manhattan's own
    expect(display.color.scale).toBe('none')
  })

  it('keeps the base-display slots after dropping the wiggle base', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.height).toBeGreaterThan(0)
    // explicitIdentifier had come from the wiggle schema; without it every
    // display would share a config node
    expect(display.configuration.displayId).toBeDefined()
  })

  it('publishes no slot it never reads', () => {
    const slots = Object.keys(
      getConfigurationSchemaDefinition(configSchemaFactory())!,
    )
    expect(slots).toContain('height')
    // baseLinearDisplayConfigSchema's remaining slots. Manhattan never enables
    // the byte gate and draws no features, so these were documented promises
    // nothing kept.
    expect(slots).not.toContain('mouseover')
    expect(slots).not.toContain('jexlFilters')
    expect(slots).not.toContain('maxFeatureScreenDensity')
    expect(slots).not.toContain('fetchSizeLimit')
    expect(slots).not.toContain('forceLoad')
  })

  it('builds its whole track menu without reading a missing slot', () => {
    const { display } = createTestEnvironment().createDisplay()
    const walk = (items: unknown[]): string[] =>
      items.flatMap(i => {
        const it = i as { label?: string; subMenu?: unknown[] }
        return [it.label ?? '', ...(it.subMenu ? walk(it.subMenu) : [])]
      })
    const labels = walk(display.trackMenuItems())
    // the score submenu is there, but neither radio group the plot ignores
    expect(labels).toContain('Set min/max score...')
    expect(labels).not.toContain('Autoscale type')
    expect(labels).not.toContain('Scale type')
    // and nothing wiggle-only leaked in with the mixin
    expect(labels).not.toContain('Resolution')
    expect(labels).not.toContain('Summary score mode')
  })
})
