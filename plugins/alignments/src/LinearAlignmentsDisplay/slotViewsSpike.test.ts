import { ConfigurationSchema, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { slotViews } from './slotViewsSpike.ts'

const configSchema = ConfigurationSchema('SpikeDisplay', {
  showCoverage: { type: 'boolean', defaultValue: true },
  coverageHeight: { type: 'number', defaultValue: 45 },
})

const Model = types
  .model('SpikeDisplay', { configuration: configSchema })
  .views(self => slotViews(self, ['showCoverage', 'coverageHeight']))

test('a derived slot view is a computed that follows the slot', () => {
  const model = Model.create({ configuration: {} })
  const seen: number[] = []
  const dispose = autorun(() => {
    seen.push(model.coverageHeight)
  })
  expect(model.showCoverage).toBe(true)
  setConf(model, 'coverageHeight', 60)
  setConf(model, 'showCoverage', false)
  expect(seen).toEqual([45, 60])
  expect(model.showCoverage).toBe(false)
  dispose()
})
