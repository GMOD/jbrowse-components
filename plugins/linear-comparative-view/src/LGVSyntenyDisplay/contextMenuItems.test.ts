import { SimpleFeature } from '@jbrowse/core/util'

import { createDisplay } from './testEnv.ts'

// Clickable items only: the heading over the launch group is asserted on its
// own below, and every other case is about what can be clicked.
function labels(display: ReturnType<typeof createDisplay>) {
  return display
    .contextMenuItems()
    .filter((i: unknown) => (i as { type?: string }).type !== 'subHeader')
    .map((i: unknown) => (i as { label?: string }).label)
}

function makeFeature(mateAssembly: string, CIGAR?: string) {
  return new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    CIGAR,
    mate: { refName: 'ctgB', start: 0, end: 100, assemblyName: mateAssembly },
  })
}

// The block the right-click landed in, which the move maps across and the launch
// clips to. Every case below opens the menu the same way, so a missing item is
// about the gate under test rather than about a missing block.
function rightClick(
  display: ReturnType<typeof createDisplay>,
  feature?: SimpleFeature,
) {
  display.openContextMenu({
    anchor: { clientX: 1, clientY: 2 },
    featureId: 'f1',
    hit: { block: { bpRange: [0, 1000], refName: 'ctgA' }, genomicPos: 500 },
  })
  if (feature) {
    display.setContextMenuFeature(feature)
  }
  return labels(display)
}

// The whole point of building these from the id: the feature behind a
// right-clicked PAF block arrives an RPC later (a whole-block re-read, before
// the lookup was narrowed), and gating the items on it opened a menu with
// nothing in it.
test('the block items are there before the feature fetch lands', () => {
  const display = createDisplay()
  display.openContextMenu({
    anchor: { clientX: 1, clientY: 2 },
    featureId: 'f1',
  })
  expect(display.contextMenuFeature).toBeUndefined()
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

// The exception, and why it goes last: whether a synteny view can open is a
// per-feature question (the mate's assembly), so it can only appear once the
// feature lands — appending, rather than inserting above items the cursor is
// already over.
test('a launchable mate appends the synteny item when the feature lands', () => {
  const display = createDisplay()
  display.openContextMenu({
    anchor: { clientX: 1, clientY: 2 },
    featureId: 'f1',
  })
  display.setContextMenuFeature(makeFeature('volvox_random'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
    'Launch synteny view for this position',
    'Open volvox_random at the matching region',
  ])
})

// The jump, as distinct from the comparison: a mate the session holds as an
// assembly can be opened on its own whether or not the track declares it,
// which is the loaded-PanSN-sample case the launch has to refuse.
test('a loaded mate the track does not declare can still be opened on its own', () => {
  const labelled = rightClick(
    createDisplay({ loadedAssemblies: ['volvox', 'HG002#1'] }),
    makeFeature('HG002#1'),
  )
  expect(labelled).not.toContain(LAUNCH)
  expect(labelled).toContain('Open HG002#1 at the matching region')
})

// A one-vs-all mate can be a PanSN sample that is no declared assembly of the
// track; offering a view that fails to open would be worse than not offering it.
test('a mate outside the track assemblies gets no synteny item', () => {
  const display = createDisplay()
  display.openContextMenu({
    anchor: { clientX: 1, clientY: 2 },
    featureId: 'f1',
  })
  display.setContextMenuFeature(makeFeature('HG002#1'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

test('a right-click on no feature offers no feature items', () => {
  const display = createDisplay()
  display.openContextMenu({ anchor: { clientX: 1, clientY: 2 } })
  expect(labels(display)).toEqual([])
})

const MOVE = 'Move other panel to the matching region'
const LAUNCH = 'Launch synteny view for this position'

test('a panel whose neighbour is on the mate assembly can move it', () => {
  const display = createDisplay({ neighbourAssembly: 'volvox_random' })
  expect(rightClick(display, makeFeature('volvox_random', '100M'))).toContain(
    MOVE,
  )
})

// In a standalone linear view there is no neighbour to move, and launching a
// synteny view is the whole answer.
test('a standalone view offers the launch and no move', () => {
  const labelled = rightClick(
    createDisplay(),
    makeFeature('volvox_random', '100M'),
  )
  expect(labelled).toContain(LAUNCH)
  expect(labelled).not.toContain(MOVE)
})

// Without a CIGAR the mate position can only be interpolated across the block,
// and this parks a panel flush against its neighbour — presenting the guess as
// a correspondence. The launch still stands: its dialog pads the result and
// shows what it resolved.
test('a CIGAR-less block offers the launch and no move', () => {
  const labelled = rightClick(
    createDisplay({ neighbourAssembly: 'volvox_random' }),
    makeFeature('volvox_random'),
  )
  expect(labelled).toContain(LAUNCH)
  expect(labelled).not.toContain(MOVE)
})

test('a neighbour on some other assembly is not offered', () => {
  expect(
    rightClick(
      createDisplay({ neighbourAssembly: 'volvox' }),
      makeFeature('volvox_random', '100M'),
    ),
  ).not.toContain(MOVE)
})

// The move used to be nested inside the launch's gate, so it inherited a
// condition it does not need. An all-vs-all track draws mates for PanSN samples
// it does not declare in `assemblyNames` — the adapter's own docs say so — and
// the launch is rightly hidden for those. But with a neighbouring panel already
// open on that sample, moving it is perfectly well defined, and it was silently
// unavailable.
test('a mate outside the track assemblies can still move a panel already on it', () => {
  const labelled = rightClick(
    createDisplay({ neighbourAssembly: 'HG002#1' }),
    makeFeature('HG002#1', '100M'),
  )
  expect(labelled).not.toContain(LAUNCH)
  expect(labelled).toContain(MOVE)
})

// The three ways out into another view read alike back to back, so they sit
// under one heading — and the heading is absent when none of them is offered.
test('the launch items sit under one heading, the move outside it', () => {
  const display = createDisplay({ neighbourAssembly: 'volvox_random' })
  rightClick(display, makeFeature('volvox_random', '100M'))
  const items = display.contextMenuItems() as {
    type?: string
    label?: string
  }[]
  const heading = items.findIndex(i => i.type === 'subHeader')
  expect(items[heading]?.label).toBe('Launch')
  expect(items[heading + 1]?.label).toBe(LAUNCH)
  expect(items.at(-1)?.label).toBe(MOVE)
  const noLaunch = createDisplay({ neighbourAssembly: 'HG002#1' })
  rightClick(noLaunch, makeFeature('HG002#1', '100M'))
  expect(
    (noLaunch.contextMenuItems() as { type?: string }[]).some(
      i => i.type === 'subHeader',
    ),
  ).toBe(false)
})

const LAUNCH_ALL = 'Launch synteny view for all assemblies here'

// A block on a track declaring three or more assemblies can reach more than
// the one mate under the cursor, so the multi-panel launch is offered beside
// the pairwise one, cut from this track at the clicked block.
test('a three-assembly track also offers the multi-panel launch', () => {
  const labelled = rightClick(
    createDisplay({
      trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_extra'],
    }),
    makeFeature('volvox_random'),
  )
  expect(labelled).toContain(LAUNCH)
  expect(labelled).toContain(LAUNCH_ALL)
})

// On a pairwise track the region launch would discover the one mate the
// pairwise item already opens, with a fetch in front of it.
test('a pairwise track offers only the pairwise launch', () => {
  expect(
    rightClick(createDisplay(), makeFeature('volvox_random')),
  ).not.toContain(LAUNCH_ALL)
})
