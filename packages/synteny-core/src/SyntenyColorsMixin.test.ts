import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { SyntenyColorsMixin } from './SyntenyColorsMixin.ts'

function view(snap: Record<string, unknown> = {}) {
  return SyntenyColorsMixin({ defaultOpacity: 0.2 }).create(snap)
}

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
  expect(getSnapshot(v).opacity).toMatchObject({ value: 0.5 })
  v.setOpacityField('identity')
  v.setOpacity(0.25)
  expect(v.opacityLevel).toBeCloseTo(0.25)
  expect(v.opacitySetting.range!.map(Number)).toEqual([
    expect.closeTo(0.075),
    expect.closeTo(0.25),
  ])
})

// a dimmed whole-genome view stays dim when its fade turns on, and the fade
// turned off leaves it where the fade's top was
test('the identity fade runs from the current opacity, and back', () => {
  const v = view({ opacity: 0.4 })
  v.setOpacityField('identity')
  expect(v.opacityLevel).toBeCloseTo(0.4)
  expect(v.opacitySetting.range!.map(Number)).toEqual([
    expect.closeTo(0.12),
    expect.closeTo(0.4),
  ])
  v.setOpacityField('')
  expect(v.opacityField).toBe('')
  expect(v.opacityLevel).toBeCloseTo(0.4)
  v.setOpacity(0.2)
  v.setOpacityField('identity')
  v.setOpacityField('')
  expect(getSnapshot(v).opacity).toBeUndefined()
})

test('a drag recolours nothing, under the constant or a field', () => {
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
