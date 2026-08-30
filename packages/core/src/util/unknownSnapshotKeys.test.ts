import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { captureUnknownSnapshotKeys } from './unknownSnapshotKeys.ts'

import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

function viewModel(name: string) {
  return types.model(name, {
    type: types.literal(name),
    init: types.frozen<Record<string, unknown> | undefined>(),
    showThing: types.optional(types.boolean, false),
  })
}

const TestView = captureUnknownSnapshotKeys(viewModel('TestView'))

// afterAttach is the report site, so a view has to be attached to something
function attach(view: IAnyModelType, snap: unknown) {
  return types.model({ view }).create({ view: snap }).view as IStateTreeNode & {
    unknownSnapshotKeys?: Record<string, unknown>
    showThing?: boolean
  }
}

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

test('a key naming no declared property is named on attach', () => {
  attach(TestView, { type: 'TestView', assembly: 'hg38', loc: 'chr1:1-100' })
  expect(warnings()).toEqual(['TestView ignored unknown key(s): assembly, loc'])
})

test('the key is kept, not dropped, so attach can still see it', () => {
  const view = attach(TestView, { type: 'TestView', assembly: 'hg38' })
  expect(view.unknownSnapshotKeys).toEqual({ assembly: 'hg38' })
})

test('the capture never reaches an output snapshot', () => {
  const view = attach(TestView, { type: 'TestView', assembly: 'hg38' })
  expect(getSnapshot(view)).toEqual({ type: 'TestView', showThing: false })
})

test('the same keys nested in init are the good path', () => {
  attach(TestView, {
    type: 'TestView',
    showThing: true,
    init: { assembly: 'hg38', loc: 'chr1:1-100' },
  })
  expect(warnings()).toEqual([])
})

test('the declared set comes off the composed model, mixins included', () => {
  const composed = captureUnknownSnapshotKeys(
    types.compose(
      'ComposedView',
      viewModel('TestView'),
      types.model({ fromMixin: types.optional(types.number, 1) }),
    ),
  )
  attach(composed, { type: 'TestView', fromMixin: 2 })
  expect(warnings()).toEqual([])
})

// The session's view type is a `types.union`, so MST runs every member's
// preprocessor against every candidate while deciding which one matches. A
// report from inside the preprocessor fires for snapshots that are about to be
// rejected; this is the regression that keeps it in afterAttach.
test('a union probing one view type against another says nothing', () => {
  // `otherOnly` names no property of TestView, which the union probes first
  const Other = captureUnknownSnapshotKeys(
    types.compose(
      'OtherView',
      viewModel('OtherView'),
      types.model({ otherOnly: types.optional(types.string, '') }),
    ),
  )
  const parent = types
    .model({ view: types.union(TestView, Other) })
    .create({ view: { type: 'OtherView', otherOnly: 'x' } })
  expect(parent.view.type).toBe('OtherView')
  expect(warnings()).toEqual([])
})

// MST runs preprocessors in the reverse of the order they were added, so the
// call has to sit on the chain BEFORE a view's legacy remap for the capture to
// see what MST finally consumes. Placed the other way round, this captures
// `legacyThing` — a key the remap converts — and reports it as a typo.
test('a legacy key its own remap converts is not captured', () => {
  const withRemap = captureUnknownSnapshotKeys(
    viewModel('TestView'),
  ).preProcessSnapshot((snap: Record<string, unknown>) => {
    const { legacyThing, ...rest } = snap
    return { ...rest, showThing: legacyThing }
  })
  const view = attach(withRemap, { type: 'TestView', legacyThing: true })
  expect(view.showThing).toBe(true)
  expect(warnings()).toEqual([])
})

test('`legacy` covers what a composed base converts', () => {
  const base = types
    .model('Base', { type: types.string })
    .preProcessSnapshot((snap: Record<string, unknown>) => {
      const { oldName, ...rest } = snap
      return { ...rest, ...(oldName ? { keep: oldName } : {}) }
    })
  const sub = captureUnknownSnapshotKeys(
    types.compose('SubView', base, types.model({ keep: types.frozen() })),
    { legacy: ['oldName'] },
  )
  attach(sub, { type: 'SubView', oldName: 'x' })
  expect(warnings()).toEqual([])
})
