import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import {
  defineLaunchKeys,
  pendingLaunch,
  withLaunchInput,
} from './withLaunchInput.ts'

import type { LaunchInput } from './withLaunchInput.ts'
import type {
  IAnyModelType,
  IStateTreeNode,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

interface TestCommands {
  assembly: string
  tracks?: (string | { trackId: string })[]
  highlight?: (string | { refName: string })[]
  views?: unknown[]
  sameScale?: boolean
}

const keys = defineLaunchKeys<TestCommands>()(
  {
    assembly: { kind: 'launch' },
    tracks: { kind: 'trackEntries' },
    highlight: { kind: 'highlightEntries' },
    views: { kind: 'rows' },
    sameScale: { kind: 'replay' },
  },
  { passThrough: ['legacySpelling'] },
)

function viewModel(name: string) {
  return types.model(name, {
    type: types.literal(name),
    launch: types.frozen<LaunchInput<TestCommands> | undefined>(),
    tracks: types.array(types.frozen()),
    highlight: types.array(types.frozen()),
    views: types.array(types.frozen()),
    sameScale: types.optional(types.boolean, false),
    showThing: types.optional(types.boolean, false),
  })
}

const TestView = withLaunchInput(viewModel('TestView'), keys)

// afterAttach is the report site, so a view has to be attached to something
function attach(view: IAnyModelType, snap: unknown) {
  return types.model({ view }).create({ view: snap }).view as IStateTreeNode & {
    launch?: LaunchInput<TestCommands>
    tracks?: unknown[]
    highlight?: unknown[]
    views?: unknown[]
    sameScale?: boolean
  }
}

const open = (snap: unknown) => attach(TestView, snap)

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

test('a launch key written on the view object moves into `launch`', () => {
  const view = open({ type: 'TestView', assembly: 'hg38', showThing: true })
  expect(view.launch).toEqual({ assembly: 'hg38' })
  expect(getSnapshot(view).showThing).toBe(true)
  expect(warnings()).toEqual([])
})

test('a view with nothing to launch gets no blob', () => {
  expect(open({ type: 'TestView', showThing: true }).launch).toBeUndefined()
})

test('a key naming neither a launch key nor a property is reported on attach', () => {
  open({ type: 'TestView', assembly: 'hg38', asembly: 'hg19' })
  expect(warnings()).toEqual(['TestView ignored unknown key(s): asembly'])
})

test('a blob holding only what to report is not pending work', () => {
  const view = open({ type: 'TestView', asembly: 'hg19' })
  expect(view.launch).toEqual({ unknown: { asembly: 'hg19' } })
  expect(pendingLaunch(view.launch)).toBeUndefined()
})

test('a blob with one command is pending, bookkeeping and all', () => {
  const view = open({ type: 'TestView', assembly: 'hg38', asembly: 'hg19' })
  // the blob itself, not a copy: the launch autorun clears by identity
  expect(pendingLaunch(view.launch)).toBe(view.launch)
})

test('a declared property is settable with nothing listing it', () => {
  const view = open({ type: 'TestView', showThing: true })
  expect(getSnapshot(view).showThing).toBe(true)
  expect(warnings()).toEqual([])
})

test('`passThrough` keeps a legacy spelling on the snapshot', () => {
  // it reaches the model's own preProcessSnapshot rather than the unknown
  // bucket; here nothing converts it, so only the absence of a report is
  // observable
  open({ type: 'TestView', legacySpelling: 1 })
  expect(warnings()).toEqual([])
})

test('the identity keys are never lifted', () => {
  const view = open({ type: 'TestView', id: 'pinned' })
  expect(getSnapshot(view).type).toBe('TestView')
  expect(view.launch).toBeUndefined()
})

describe('the per-entry discriminators', () => {
  test('trackEntries: a string or a `trackId` object is a recipe', () => {
    expect(
      open({ type: 'TestView', tracks: ['genes', { trackId: 'x' }] }).launch,
    ).toEqual({ tracks: ['genes', { trackId: 'x' }] })
  })

  test('trackEntries: a built snapshot stays on the property', () => {
    const view = open({
      type: 'TestView',
      tracks: [{ type: 'FeatureTrack', configuration: 'genes' }],
    })
    expect(view.launch).toBeUndefined()
    expect(view.tracks).toHaveLength(1)
  })

  test('trackEntries: a mixed array splits per entry', () => {
    const built = { type: 'FeatureTrack', configuration: 'genes' }
    const view = open({ type: 'TestView', tracks: ['genes', built] })
    expect(view.launch).toEqual({ tracks: ['genes'] })
    expect(view.tracks).toEqual([built])
  })

  test('trackEntries: a bare entry is not walked as a string', () => {
    expect(open({ type: 'TestView', tracks: 'genes' }).launch).toEqual({
      tracks: 'genes',
    })
  })

  test('highlightEntries: a string launches, an object persists', () => {
    const persisted = { refName: 'chr1' }
    const view = open({
      type: 'TestView',
      highlight: ['chr1:1-100', persisted],
    })
    expect(view.launch).toEqual({ highlight: ['chr1:1-100'] })
    expect(view.highlight).toEqual([persisted])
  })

  test('rows: a row carrying a `type` is built', () => {
    const built = { type: 'LinearGenomeView' }
    const view = open({ type: 'TestView', views: [built, built] })
    expect(view.launch).toBeUndefined()
    expect(view.views).toEqual([built, built])
  })

  test('rows: a row without one is a recipe, an empty row included', () => {
    const view = open({ type: 'TestView', views: [{ assembly: 'hg38' }, {}] })
    expect(view.launch).toEqual({ views: [{ assembly: 'hg38' }, {}] })
    expect(view.views).toEqual([])
  })

  test('rows: a mixed list is refused whole rather than split', () => {
    const view = open({
      type: 'TestView',
      views: [{ type: 'LinearGenomeView' }, { assembly: 'hg38' }],
    })
    expect(view.views).toEqual([])
    expect(view.launch?.views).toBeUndefined()
    expect(view.launch).toEqual({
      malformed: {
        views: [{ type: 'LinearGenomeView' }, { assembly: 'hg38' }],
      },
    })
    expect(warnings()).toEqual([
      'TestView refused views: the list mixes built view snapshots with recipes to open one, and the rows index against the levels between them. Write all of them one way.',
    ])
  })

  test('rows: a refusal is not work to do', () => {
    const view = open({
      type: 'TestView',
      views: [{ type: 'LinearGenomeView' }, {}],
    })
    expect(pendingLaunch(view.launch)).toBeUndefined()
  })

  test('replay: the value lands on the property AND rides in the blob', () => {
    const view = open({ type: 'TestView', sameScale: true })
    expect(view.sameScale).toBe(true)
    expect(view.launch).toEqual({ sameScale: true })
  })
})

describe('the v4 nested form', () => {
  test('it produces the same launch state, and says it is deprecated', () => {
    const view = open({ type: 'TestView', init: { assembly: 'hg38' } })
    expect(view.launch).toEqual({ assembly: 'hg38', legacyInit: true })
    expect(warnings()).toEqual([
      'TestView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
    ])
  })

  test('a key inside it that names nothing is still reported', () => {
    open({ type: 'TestView', init: { asembly: 'hg38' } })
    expect(warnings()).toContain('TestView ignored unknown key(s): asembly')
  })

  // the comparative views' v4 `init` applied any declared property it found, so
  // a nested one lands on the property rather than reading as a typo
  test('a declared property inside it lands on the property', () => {
    const view = open({ type: 'TestView', init: { showThing: true } })
    expect(getSnapshot(view).showThing).toBe(true)
    expect(warnings()).not.toContain(
      'TestView ignored unknown key(s): showThing',
    )
  })
})

// The session's view type is a `types.union`, so MST runs every member's
// preprocessor against every candidate while deciding which one matches. A
// report from inside the preprocessor fires for snapshots that are about to be
// rejected; this is the regression that keeps it in afterAttach.
test('a union probing one view type against another says nothing', () => {
  const Other = withLaunchInput(
    types.compose(
      'OtherView',
      viewModel('OtherView'),
      types.model({ otherOnly: types.optional(types.string, '') }),
    ),
    keys,
  )
  const parent = types
    .model({ view: types.union(TestView, Other) })
    .create({ view: { type: 'OtherView', otherOnly: 'x' } })
  expect(parent.view.type).toBe('OtherView')
  expect(warnings()).toEqual([])
})

// MST runs preprocessors in the reverse of the order they were added, so the
// call has to sit on the chain BEFORE a view's legacy remap for the partition to
// see what MST finally consumes. Placed the other way round, this captures
// `legacyThing` — a key the remap converts — and reports it as a typo.
test('a legacy key its own remap converts is not captured', () => {
  const withRemap = withLaunchInput(
    viewModel('TestView'),
    keys,
  ).preProcessSnapshot((snap: Record<string, unknown>) => {
    const { legacyThing, ...rest } = snap
    return { ...rest, showThing: legacyThing }
  })
  const view = attach(withRemap, { type: 'TestView', legacyThing: true })
  expect(getSnapshot(view).showThing).toBe(true)
  expect(warnings()).toEqual([])
})

// The widening replaces the creation type, so a `.props()` after it is invisible
// to SnapshotIn — but a further pre/post processor carries it through, which is
// what lets a view keep its own legacy remap after the call. The annotation is
// the assertion: without the widening `assembly`/`tracks` are excess properties.
test('the widened snapshot type survives a later processor', () => {
  const later = withLaunchInput(viewModel('TestView'), keys).preProcessSnapshot(
    (snap: Record<string, unknown>) => snap,
  )
  const snap: SnapshotIn<typeof later> = {
    type: 'TestView',
    assembly: 'hg38',
    tracks: ['genes'],
  }
  expect(attach(later, snap).launch).toEqual({
    assembly: 'hg38',
    tracks: ['genes'],
  })
})
