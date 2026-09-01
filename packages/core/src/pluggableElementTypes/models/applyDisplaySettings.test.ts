// The routing contract of BaseDisplay.applyDisplaySettings: slots apply, the
// `type` key and unknown keys report as unapplied instead of vanishing, state
// setters fire only behind the allowSetters opt-in, and a throwing setter
// costs its own key rather than the rest of the bag.
import { types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import { BaseDisplay } from './BaseDisplayModel.tsx'

const configSchema = ConfigurationSchema(
  'TestDisplay',
  {
    height: { type: 'number', defaultValue: 100 },
  },
  { explicitIdentifier: 'displayId' },
)

const TestDisplay = types
  .compose(
    BaseDisplay,
    types.model({
      // the schema directly rather than ConfigurationReference: the reference
      // resolves through a containing track, which is machinery this contract
      // does not depend on
      configuration: configSchema,
      resolution: 1,
    }),
  )
  .actions(self => ({
    setResolution(resolution: number) {
      self.resolution = Math.min(resolution, 10)
    },
    setExplosive() {
      throw new Error('boom')
    },
  }))

function makeDisplay() {
  return TestDisplay.create({
    type: 'TestDisplay',
    configuration: { displayId: 'd1' },
  })
}

test('a slot key applies to the config and reports as applied', () => {
  const display = makeDisplay()
  const report = display.applyDisplaySettings({ height: 55 })
  expect(readConfObject(display.configuration, 'height')).toBe(55)
  expect(report).toEqual({ applied: ['height'], unapplied: [] })
})

test('type, unknown, and empty keys report as unapplied instead of vanishing', () => {
  const display = makeDisplay()
  const report = display.applyDisplaySettings({
    type: 'OtherDisplay',
    nonsense: 1,
    '': 2,
  })
  expect(report.applied).toEqual([])
  expect(report.unapplied).toEqual([
    'type (switch the display type instead)',
    'nonsense',
    '(empty key)',
  ])
})

test('a state setter fires only behind allowSetters', () => {
  const display = makeDisplay()
  const declined = display.applyDisplaySettings({ resolution: 64 })
  expect(display.resolution).toBe(1)
  expect(declined.unapplied[0]).toContain('setResolution')

  const report = display.applyDisplaySettings(
    { resolution: 64 },
    { allowSetters: true },
  )
  // the setter, not a raw write: the clamp proves it
  expect(display.resolution).toBe(10)
  expect(report.applied).toEqual(['resolution (via setter)'])
})

test('a throwing setter costs its key, not the rest of the bag', () => {
  const display = makeDisplay()
  const report = display.applyDisplaySettings(
    { explosive: true, height: 60 },
    { allowSetters: true },
  )
  expect(readConfObject(display.configuration, 'height')).toBe(60)
  expect(report.applied).toEqual(['height'])
  expect(report.unapplied).toHaveLength(1)
  expect(report.unapplied[0]).toContain('explosive')
  expect(report.unapplied[0]).toContain('boom')
})
