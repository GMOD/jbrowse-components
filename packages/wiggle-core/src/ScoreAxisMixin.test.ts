import { types } from '@jbrowse/mobx-state-tree'

import { ScoreAxisMixin } from './ScoreAxisMixin.ts'

const Display = types
  .compose(
    ScoreAxisMixin(),
    types.model({
      own: types.frozen<[number, number]>(),
      max: types.maybe(types.number),
    }),
  )
  .views(self => ({
    get autoscaleRange() {
      return self.own
    },
    get domainMax() {
      return self.max
    },
    get defaultScoreDomain(): [number | undefined, number | undefined] {
      return [0, 1]
    },
  }))

test('the autoscaled domain rounds inside the resolved bounds, a default filling each unpinned end', () => {
  const display = Display.create({ own: [0.2, 0.4] })
  expect([display.resolvedDomainMin, display.resolvedDomainMax]).toEqual([0, 1])
  expect(display.autoscaledDomain).toEqual([0, 1])
})

test('a pinned end wins over the default', () => {
  const display = Display.create({ own: [0.2, 0.4], max: 0.5 })
  expect(display.resolvedDomainMax).toBe(0.5)
  expect(display.autoscaledDomain).toEqual([0, 0.5])
})
