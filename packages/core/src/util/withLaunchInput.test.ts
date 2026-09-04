import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import ViewType from '../pluggableElementTypes/ViewType.ts'
import {
  defineLaunchKeys,
  pendingLaunch,
  snapshotSettings,
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

const materialized = (snap: { views?: unknown[] }) => !!snap.views?.length

const TestView = withLaunchInput(viewModel('TestView'), keys, { materialized })

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
  const DEPRECATED =
    'TestView nests its settings under "init", which is deprecated: write every setting directly on the view object.'

  test('it produces the same launch state, and says it is deprecated', () => {
    const view = open({ type: 'TestView', init: { assembly: 'hg38' } })
    expect(view.launch).toEqual({ assembly: 'hg38', legacyInit: true })
    expect(pendingLaunch(view.launch)).toBeDefined()
    expect(warnings()).toEqual([DEPRECATED])
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
  })

  test('the flat keys beside it are still read', () => {
    const view = open({ type: 'TestView', assembly: 'hg38', init: {} })
    expect(view.launch).toEqual({ assembly: 'hg38', legacyInit: true })
  })

  // the deprecated spelling loses, so migrating one key at a time cannot make a
  // view worse than it was
  test('the flat spelling wins where both name one key', () => {
    const view = open({
      type: 'TestView',
      assembly: 'hg38',
      init: { assembly: 'mm39' },
    })
    expect(view.launch).toEqual({ assembly: 'hg38', legacyInit: true })
  })

  // a passThrough key is accepted flat, so reporting it as unknown when nested
  // would name a key the same snapshot takes one line higher up
  test('a passThrough key inside it is not reported as unknown', () => {
    open({ type: 'TestView', init: { legacySpelling: 1 } })
    expect(warnings()).toEqual([DEPRECATED])
  })

  // `"init": null` is a thing JSON writes, and it nests nothing
  test('a null or scalar init says nothing', () => {
    open({ type: 'TestView', init: null })
    open({ type: 'TestView', init: 'nonsense' })
    expect(warnings()).toEqual([])
  })
})

describe('what the launch blob persists', () => {
  // the flag names the spelling of the snapshot the view was OPENED from, and a
  // saved one does not use it; nothing clears the blob, so persisting the flag
  // would report nesting on every restore forever
  test('the deprecation flag is not saved, and a restore does not repeat it', () => {
    const view = open({ type: 'TestView', init: { assembly: 'hg38' } })
    const snap = getSnapshot(view)
    expect(snap.launch).toEqual({ assembly: 'hg38' })
    warn.mockClear()
    open(snap)
    expect(warnings()).toEqual([])
  })

  test('a blob left holding nothing else leaves the snapshot entirely', () => {
    const view = open({ type: 'TestView', init: {} })
    expect(view.launch).toEqual({ legacyInit: true })
    expect(getSnapshot(view).launch).toBeUndefined()
  })

  // unlike the flag, these ride with the pending launch: a reload mid-load
  // rebuilds from the blob and reports what it discarded, once more
  test('a discarded key or row list is saved while the view has yet to materialize', () => {
    const view = open({ type: 'TestView', asembly: 'hg38' })
    expect(getSnapshot(view).launch).toEqual({
      unknown: { asembly: 'hg38' },
    })
  })

  // and once the view has materialized there is nothing left to rebuild, so a
  // saved session carries neither the launch nor a typo report about content
  // it no longer holds
  test('the whole blob leaves the snapshot once the view has materialized', () => {
    const view = open({
      type: 'TestView',
      assembly: 'hg38',
      asembly: 'hg38',
      views: [{ type: 'Row' }],
    })
    expect(view.launch).toEqual({
      assembly: 'hg38',
      unknown: { asembly: 'hg38' },
    })
    expect(getSnapshot(view).launch).toBeUndefined()
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
    { materialized },
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
  const withRemap = withLaunchInput(viewModel('TestView'), keys, {
    materialized,
  }).preProcessSnapshot((snap: Record<string, unknown>) => {
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
  const later = withLaunchInput(viewModel('TestView'), keys, {
    materialized,
  }).preProcessSnapshot((snap: Record<string, unknown>) => snap)
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

// A session spec launches through `LaunchView-<type>` without ever building a
// snapshot, so the partition never runs there and the spec path classifies its
// own keys. It reads the set off the registration, which is what keeps the two
// surfaces from growing two answers about one key.
test('a ViewType publishes the accepted set the partition reads', () => {
  const viewType = new ViewType({
    name: 'TestView',
    stateModel: TestView,
    launchKeys: keys,
    ReactComponent: () => null,
  })
  expect(viewType.acceptedKeys).toEqual(
    expect.arrayContaining([
      'type',
      'showThing',
      'assembly',
      'sameScale',
      'legacySpelling',
    ]),
  )
  expect(viewType.acceptedKeys).not.toContain('asembly')
})

// Nothing says which of an unregistered view's launcher arguments are settings,
// so a caller has to classify none of them rather than call them all typos.
test('a ViewType registering no launch keys publishes no set', () => {
  const viewType = new ViewType({
    name: 'TestView',
    stateModel: TestView,
    ReactComponent: () => null,
  })
  expect(viewType.acceptedKeys).toBeUndefined()
})

// A parent that applies a row's launch itself (the synteny view navigates and
// loads tracks for its LGV rows) hands the row snapshot the rest, and the row's
// own partition decides property vs typo — so a misspelling stays in, to be
// reported there, and a pass-through legacy key stays in for the row's remap.
describe('snapshotSettings', () => {
  test('drops the launch keys and keeps every other key', () => {
    expect(
      snapshotSettings(
        {
          assembly: 'volvox',
          tracks: ['genes'],
          sameScale: true,
          showThing: true,
          showThng: true,
          legacySpelling: 10,
        },
        keys,
      ),
    ).toEqual({ showThing: true, showThng: true, legacySpelling: 10 })
  })

  test('identity keys are not settable even though the model declares them', () => {
    expect(
      snapshotSettings(
        { id: 'hijacked', type: 'OtherView', launch: { assembly: 'volvox' } },
        keys,
      ),
    ).toEqual({})
  })

  test('a view registering no launch keys has only settings', () => {
    expect(snapshotSettings({ showThing: true, id: 'x' }, undefined)).toEqual({
      showThing: true,
    })
  })
})
