import { getSnapshot, onPatch } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import {
  SyntenyColorsMixin,
  carriedSyntenySettings,
} from './SyntenyColorsMixin.ts'

function view(encoding?: Record<string, unknown>) {
  return SyntenyColorsMixin({ defaultOpacity: 0.2 }).create(
    encoding ? { encoding } : {},
  )
}

const opacityOf = (v: ReturnType<typeof view>) =>
  (getSnapshot(v.encoding) as { opacity?: unknown } | undefined)?.opacity

test('a number is the constant, a string the field', () => {
  expect(view({ opacity: 0.6 }).opacityLevel).toBe(0.6)
  const faded = view({ opacity: 'identity' })
  expect(faded.opacityField).toBe('identity')
  expect(faded.opacityLevel).toBe(1)
  expect(view().opacityLevel).toBe(0.2)
})

test('the slider sets the constant, or scales a field to its top', () => {
  const v = view()
  v.setOpacity(0.5)
  expect(opacityOf(v)).toMatchObject({ value: 0.5 })
  v.setOpacityField('identity')
  v.setOpacity(0.25)
  expect(v.opacityLevel).toBeCloseTo(0.25)
  expect(v.opacitySetting.scale!.range!.map(Number)).toEqual([
    expect.closeTo(0.075),
    expect.closeTo(0.25),
  ])
})

test('the slider scales a threshold with no range without fading it', () => {
  const v = view({
    opacity: {
      field: 'break_FET',
      scale: { type: 'threshold', domain: ['0.05'] },
    },
  })
  v.setOpacity(0.8)
  expect(v.opacityLevel).toBeCloseTo(0.8)
  expect(v.opacitySetting.scale!.range!.map(Number)).toEqual([0.8, 0.8])
})

// a dimmed whole-genome view stays dim when its fade turns on, and the fade
// turned off leaves it where the fade's top was
test('the identity fade runs from the current opacity, and back', () => {
  const v = view({ opacity: 0.4 })
  v.setOpacityField('identity')
  expect(v.opacityLevel).toBeCloseTo(0.4)
  expect(v.opacitySetting.scale!.range!.map(Number)).toEqual([
    expect.closeTo(0.12),
    expect.closeTo(0.4),
  ])
  v.setOpacityField(undefined)
  expect(v.opacityField).toBeUndefined()
  expect(v.opacityLevel).toBeCloseTo(0.4)
  v.setOpacity(0.2)
  v.setOpacityField('identity')
  v.setOpacityField(undefined)
  expect(opacityOf(v)).toBeUndefined()
})

// every color tier keys on the channel's arrays, so a pick of what already
// paints must leave the tree alone
test('a pick of the field or constant already written patches nothing', () => {
  const v = view({ color: { field: 'identity', scale: { domain: ['0.9'] } } })
  const patches: unknown[] = []
  const stop = onPatch(v, patch => patches.push(patch))
  v.setColorField('identity')
  stop()
  expect(patches).toEqual([])

  const solid = view({ color: { value: 'grey' } })
  const solidPatches: unknown[] = []
  const stopSolid = onPatch(solid, patch => solidPatches.push(patch))
  solid.setColorValue('grey')
  stopSolid()
  expect(solidPatches).toEqual([])
})

// the view that opens on the same alignments takes the color, and keeps its
// own opacity default
test('carriedSyntenySettings hands on encoding.color alone', () => {
  const v = view({ color: 'query', opacity: 0.5 })
  expect(carriedSyntenySettings(v)).toMatchObject({
    encoding: { color: { field: 'query' } },
  })
  expect(carriedSyntenySettings(v).encoding).not.toHaveProperty('opacity')
  expect(carriedSyntenySettings(view())).not.toHaveProperty('encoding')
  expect(
    carriedSyntenySettings(view({ color: { field: '' } })),
  ).not.toHaveProperty('encoding')
  const solid = view({ color: { value: 'grey' } })
  expect(carriedSyntenySettings(solid)).toMatchObject({
    encoding: { color: { value: 'grey' } },
  })
})

test('a drag recolors nothing, under the constant or a field', () => {
  const v = view()
  let fades = 0
  const dispose = autorun(() => {
    void v.opacityFade
    fades++
  })
  v.setOpacity(0.5)
  v.setOpacity(0.3)
  expect(fades).toBe(1)
  v.setOpacityField('identity')
  expect(fades).toBe(2)
  v.setOpacity(0.9)
  v.setOpacity(0.1)
  expect(fades).toBe(2)
  dispose()
})
