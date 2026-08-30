import { types } from '@jbrowse/mobx-state-tree'

import { warnUnknownSnapshotKeys } from './warnUnknownSnapshotKeys.ts'

function testView() {
  return types.model('TestView', {
    type: types.literal('TestView'),
    init: types.frozen<Record<string, unknown> | undefined>(),
    showThing: types.optional(types.boolean, false),
  })
}

const checked = warnUnknownSnapshotKeys(testView())

test('a key naming no declared property is reported', () => {
  checked.create({ type: 'TestView', assembly: 'hg38' } as any)
  // MST preprocesses twice per create with typechecking on, so count nothing
  const report = takeContractReports().join('\n')
  expect(report).toContain('[jbrowse view contract]')
  expect(report).toContain('TestView')
  expect(report).toContain('assembly')
  expect(report).toContain('init')
})

test('the same keys nested in init are the good path', () => {
  checked.create({
    type: 'TestView',
    showThing: true,
    init: { assembly: 'hg38', loc: 'chr1:1-100' },
  })
  expect(takeContractReports()).toEqual([])
})

test('the declared set comes off the composed model, mixins included', () => {
  const composed = warnUnknownSnapshotKeys(
    types.compose(
      'ComposedView',
      testView(),
      types.model({ fromMixin: types.optional(types.number, 1) }),
    ),
  )
  composed.create({ type: 'TestView', fromMixin: 2 })
  expect(takeContractReports()).toEqual([])
})

// MST runs preprocessors in the reverse of the order they were added, so the
// call has to sit on the chain BEFORE a view's legacy remap for the check to
// see what MST finally consumes. Placed the other way round, this reports
// `legacyThing` — a key the remap converts — as a typo.
test('a legacy key its own remap converts is not reported', () => {
  const withRemap = warnUnknownSnapshotKeys(testView()).preProcessSnapshot(
    (snap: Record<string, unknown>) => {
      const { legacyThing, ...rest } = snap
      return { ...rest, showThing: legacyThing }
    },
  )
  const view = withRemap.create({ type: 'TestView', legacyThing: true } as any)
  expect(view.showThing).toBe(true)
  expect(takeContractReports()).toEqual([])
})

test('`legacy` covers what a composed base converts', () => {
  const base = types
    .model('Base', { type: types.string })
    .preProcessSnapshot((snap: Record<string, unknown>) => {
      const { oldName, ...rest } = snap
      return { ...rest, ...(oldName ? { keep: oldName } : {}) }
    })
  const sub = warnUnknownSnapshotKeys(
    types.compose('SubView', base, types.model({ keep: types.frozen() })),
    { legacy: ['oldName'] },
  )
  sub.create({ type: 'SubView', oldName: 'x' } as any)
  expect(takeContractReports()).toEqual([])
})
