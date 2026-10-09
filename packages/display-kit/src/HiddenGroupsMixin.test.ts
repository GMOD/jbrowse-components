import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import HiddenGroupsMixin from './HiddenGroupsMixin.ts'
import { sectionFacetConfigSchema } from './sectionFacetConfigSchema.ts'

const HostConfig = ConfigurationSchema('HiddenGroupsHost', {
  facet: sectionFacetConfigSchema,
})

const Host = types
  .compose(
    HiddenGroupsMixin(),
    types.model({
      configuration: HostConfig,
      degraded: types.optional(types.boolean, false),
    }),
  )
  .volatile(() => ({ overrides: new Map<string, number>() }))
  .views(self => ({
    get groupKeySpace(): string {
      return self.degraded ? '' : getConf(self, ['facet', 'field'])
    },
  }))
  .actions(self => ({
    setDegraded(degraded: boolean) {
      self.degraded = degraded
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
  attach(facet: unknown = 'strand') {
    self.host = Host.create({ configuration: { facet } })
  },
}))

function attached(facet?: unknown) {
  const root = Root.create({})
  root.attach(facet)
  return root.host!
}

test('hide and restore, written to the facet and read back as a fresh Set', () => {
  const host = attached()
  const before = host.hiddenGroupKeys
  host.hideGroup('-1')
  expect([...host.hiddenGroupKeys]).toEqual(['-1'])
  expect(host.hiddenGroupKeys).not.toBe(before)
  expect(getSnapshot(host.configuration.facet)).toMatchObject({
    hidden: ['-1'],
  })
  host.showAllGroups()
  expect(host.hiddenGroupKeys.size).toBe(0)
})

test('a config naming hidden sections opens with them hidden', () => {
  const host = attached({ field: 'strand', hidden: ['0'] })
  expect([...host.hiddenGroupKeys]).toEqual(['0'])
})

test('hiddenGroupKeys folds in what the display hides for itself', () => {
  const Self = Host.views(() => ({
    get displayHiddenGroupKeys(): ReadonlySet<string> {
      return new Set(['self'])
    },
  }))
  const host = Self.create({ configuration: { facet: 'strand' } })
  expect([...host.hiddenGroupKeys]).toEqual(['self'])
  host.hideGroup('-1')
  expect([...host.hiddenGroupKeys].sort()).toEqual(['-1', 'self'])
})

// A chain grouping by nothing where the facet names a per-read field: the
// hidden keys name that field's sections, and `''` would hide the whole
// ungrouped stack.
test('a grouping that is not the facet field leaves the hidden sections unread', () => {
  const host = attached({ field: 'tags.HP', hidden: [''] })
  expect([...host.hiddenGroupKeys]).toEqual([''])
  host.setDegraded(true)
  expect(host.hiddenGroupKeys.size).toBe(0)
  host.setDegraded(false)
  expect([...host.hiddenGroupKeys]).toEqual([''])
})

test("a key-space move drops the display's own state and keeps the facet's", () => {
  const host = attached({ field: 'tags.HP', hidden: ['1'] })
  host.overrides.set('2', 40)
  host.setDegraded(true)
  expect(host.overrides.size).toBe(0)
  expect(getSnapshot(host.configuration.facet)).toMatchObject({
    hidden: ['1'],
  })
})
