import { types } from '@jbrowse/mobx-state-tree'

import ViewType from './ViewType.ts'

test('a loader that rejected is retried by the next load', async () => {
  let calls = 0
  const model = types.model('RetriedView', { type: 'RetriedView' })
  const viewType = new ViewType({
    name: 'RetriedView',
    stateModel: () => {
      calls++
      return calls === 1
        ? Promise.reject(new Error('chunk failed'))
        : Promise.resolve(model)
    },
    ReactComponent: () => null,
  })
  await expect(viewType.loadStateModel()).rejects.toThrow('chunk failed')
  await expect(viewType.loadStateModel()).resolves.toBe(model)
  expect(calls).toBe(2)
})
