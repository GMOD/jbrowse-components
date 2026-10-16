import { types } from '@jbrowse/mobx-state-tree'

import { isLiveModel } from './isLiveModel.ts'

const Model = types.model({}).actions(() => ({
  forceLoad() {},
}))

test('a plain object is callable; only an MST node has liveness to lose', () => {
  expect(isLiveModel({ forceLoad: () => {} })).toBe(true)

  const node = Model.create({})
  expect(isLiveModel(node)).toBe(true)
})

test('a destroyed node is not callable', () => {
  const parent = types
    .model({ child: types.maybe(Model) })
    .actions(self => ({
      drop() {
        self.child = undefined
      },
    }))
    .create({ child: {} })
  const child = parent.child!

  expect(isLiveModel(child)).toBe(true)
  parent.drop()
  expect(isLiveModel(child)).toBe(false)
})
