import { types } from '@jbrowse/mobx-state-tree'

import HiddenGroupsMixin from './HiddenGroupsMixin.ts'

const Host = types
  .compose(
    HiddenGroupsMixin(),
    types.model({ groupKeySpace: types.optional(types.string, 'strand') }),
  )
  .volatile(() => ({ overrides: new Map<string, number>() }))
  .actions(self => ({
    setGroupKeySpace(space: string) {
      self.groupKeySpace = space
    },
  }))
  .actions(self => {
    const dropHidden = self.dropGroupState
    return {
      dropGroupState() {
        dropHidden()
        self.overrides.clear()
      },
    }
  })

const Root = types.model({ host: types.maybe(Host) }).actions(self => ({
  attach() {
    self.host = Host.create({})
  },
}))

function attached() {
  const root = Root.create({})
  root.attach()
  return root.host!
}

test('hide and restore, read back as a fresh Set', () => {
  const host = attached()
  const before = host.hiddenGroupKeys
  host.hideGroup('-')
  expect([...host.hiddenGroupKeys]).toEqual(['-'])
  expect(host.hiddenGroupKeys).not.toBe(before)
  host.showAllGroups()
  expect(host.hiddenGroupKeys.size).toBe(0)
})

test('hiddenGroupKeys folds in what the display hides for itself', () => {
  const Self = Host.views(() => ({
    get displayHiddenGroupKeys(): ReadonlySet<string> {
      return new Set(['self'])
    },
  }))
  const host = Self.create({})
  expect([...host.hiddenGroupKeys]).toEqual(['self'])
  host.hideGroup('-')
  expect([...host.hiddenGroupKeys].sort()).toEqual(['-', 'self'])
})

test('a key-space move drops the state through the host override', () => {
  const host = attached()
  host.hideGroup('-')
  host.overrides.set('+', 40)
  host.setGroupKeySpace('tag\0HP')
  expect(host.hiddenGroupKeys.size).toBe(0)
  expect(host.overrides.size).toBe(0)
})
